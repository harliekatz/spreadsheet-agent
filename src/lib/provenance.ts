/**
 * Source references.
 *
 * Every value the agent puts in the grid can be traced back to something:
 * a field on a record in the synthetic dataset, a derived formula over other
 * fields, a cell in a document the user imported, or an edit the user typed
 * themselves. This module answers that question for any cell, column or row.
 *
 * Nothing here is stored per cell. Provenance is derived by comparing the
 * sheet against the source record it was built from, which keeps saved sheets
 * small and means edits are detected rather than tracked.
 */

import { catalog, dataset, fieldByName } from "./data";
import { matchesClause } from "./query";
import type {
  CellValue,
  ColumnPlan,
  DatasetMeta,
  Field,
  FieldMeta,
  FilterClause,
  Product,
  Sheet,
} from "./types";
import { SOURCE_ID } from "./types";

export type CellSource =
  | {
      kind: "dataset";
      dataset: DatasetMeta;
      recordId: string;
      field: FieldMeta;
      value: CellValue;
    }
  | {
      kind: "derived";
      dataset: DatasetMeta;
      recordId: string;
      field: FieldMeta;
      formula: string;
      value: CellValue;
    }
  | {
      kind: "edited";
      value: CellValue;
      previousValue?: CellValue;
      field: Field;
      recordId?: string;
    }
  | {
      kind: "document";
      file: string;
      recordId: string;
      column: Field;
      value: CellValue;
    }
  | { kind: "empty"; field: Field };

export const sourceIdOf = (row: Product | undefined): string | undefined => {
  if (!row) return undefined;
  const id = row[SOURCE_ID] ?? row.SKU;
  return id === undefined ? undefined : String(id);
};

/** Where a single cell's value came from. */
export function cellSource(sheet: Sheet, rowIndex: number, field: Field): CellSource {
  const row = sheet.rows[rowIndex];
  if (!row || !field) return { kind: "empty", field: field || "" };
  const value = row[field];
  if (value === undefined) return { kind: "empty", field };

  const recordId = sourceIdOf(row);

  if (sheet.sourceFile) {
    return {
      kind: "document",
      file: sheet.sourceFile,
      recordId: recordId ?? `row ${rowIndex + 1}`,
      column: field,
      value,
    };
  }

  const record = recordId ? catalog.get(recordId) : undefined;
  const meta = fieldByName.get(field);

  if (!record || !meta) {
    return { kind: "edited", value, field, recordId };
  }

  const original = record[field];
  if (original === undefined) return { kind: "edited", value, field, recordId };

  if (String(original) !== String(value)) {
    return { kind: "edited", value, previousValue: original, field, recordId };
  }

  if (meta.derivedFrom) {
    return {
      kind: "derived",
      dataset,
      recordId: recordId!,
      field: meta,
      formula: meta.derivedFrom,
      value,
    };
  }

  return { kind: "dataset", dataset, recordId: recordId!, field: meta, value };
}

/** True when the user has typed over the dataset value in this cell. */
export function isEdited(sheet: Sheet, rowIndex: number, field: Field): boolean {
  return cellSource(sheet, rowIndex, field).kind === "edited";
}

/** Which plan clauses selected this row, for the "why this row" explanation. */
export function rowSource(
  sheet: Sheet,
  rowIndex: number,
): { recordId?: string; clauses: FilterClause[]; allMatched: boolean } {
  const row = sheet.rows[rowIndex];
  const clauses = sheet.plan?.filters ?? [];
  if (!row) return { clauses: [], allMatched: false };
  return {
    recordId: sourceIdOf(row),
    clauses,
    allMatched: clauses.every((clause) => matchesClause(row, clause)),
  };
}

/** Column definition plus the plan's reason for including it. */
export function columnSource(
  sheet: Sheet,
  field: Field,
): { meta?: FieldMeta; plan?: ColumnPlan } {
  return {
    meta: fieldByName.get(field),
    plan: sheet.plan?.columns.find((c) => c.field === field),
  };
}

/** Count of cells the user has changed since generation. */
export function editedCellCount(sheet: Sheet): number {
  if (sheet.sourceFile) return 0;
  let count = 0;
  for (let r = 0; r < sheet.rows.length; r += 1)
    for (const field of sheet.columns)
      if (cellSource(sheet, r, field).kind === "edited") count += 1;
  return count;
}

const REASON_TEXT: Record<ColumnPlan["reason"], string> = {
  requested: "You named this column in the request",
  intent: "Selected because the request is about this topic",
  base: "Default identifying column",
  sort: "Added because the sheet is sorted by it",
  existing: "Already on the sheet",
  imported: "Header from your imported document",
};

export const columnReasonText = (reason: ColumnPlan["reason"]) => REASON_TEXT[reason];

/** One-line description of a cell source, for tooltips and compact UI. */
export function describeSource(source: CellSource): string {
  switch (source.kind) {
    case "dataset":
      return `${source.dataset.name} · record ${source.recordId} · ${source.field.path}`;
    case "derived":
      return `Computed: ${source.formula}`;
    case "edited":
      return source.previousValue === undefined
        ? "Edited by you"
        : `Edited by you (was ${source.previousValue})`;
    case "document":
      return `${source.file} · ${source.recordId} · column "${source.column}"`;
    case "empty":
      return "Empty cell";
  }
}
