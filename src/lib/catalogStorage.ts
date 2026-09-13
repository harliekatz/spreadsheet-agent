/**
 * Local storage codec.
 *
 * Saved sheets reference up to 1,200 catalog records, each with 22 fields.
 * Writing them out verbatim overflows the browser's storage quota quickly, so
 * rows generated from the catalog are stored as a source id plus a diff against
 * the source record. Rows that came from an imported document are stored whole,
 * because there is no source record to diff against.
 */

import { catalog } from "./data";
import type { Product } from "./types";
import { SOURCE_ID } from "./types";

const MARKER = "__catalogRows";

type StoredRow =
  { whole: Product } | { id: string; patch: Record<string, unknown>; removed?: string[] };

export function stringifySaved(value: unknown): string {
  return JSON.stringify(value, (key, raw) => {
    if (key !== "rows" || !Array.isArray(raw)) return raw;
    const entries: StoredRow[] = raw.map((row: Product) => {
      const id = row[SOURCE_ID] ?? row.SKU;
      const original = id === undefined ? undefined : catalog.get(String(id));
      if (!original) return { whole: row };
      const patch = Object.fromEntries(
        Object.entries(row).filter(([field, v]) => original[field] !== v),
      );
      const removed = Object.keys(original).filter((field) => !(field in row));
      return removed.length
        ? { id: String(id), patch, removed }
        : { id: String(id), patch };
    });
    return { [MARKER]: 1, entries };
  });
}

export function parseSaved<T = unknown>(text: string): T {
  return JSON.parse(text, (_key, value) => {
    if (!value || value[MARKER] !== 1 || !Array.isArray(value.entries)) return value;
    return (value.entries as StoredRow[]).flatMap((entry) => {
      if ("whole" in entry) return [entry.whole];
      const original = catalog.get(entry.id);
      // A record that no longer exists in the dataset is dropped rather than
      // throwing, so one stale row cannot destroy the whole saved workspace.
      if (!original) return [];
      const row: Product = { ...original, ...entry.patch } as Product;
      for (const field of entry.removed ?? []) delete row[field];
      return [row];
    });
  }) as T;
}
