import type { Sheet } from "./types";

/** Independent duplicate. Rows are cloned so edits cannot leak between copies. */
export function copySheet(
  sheet: Sheet,
  id = crypto.randomUUID(),
  now = new Date().toISOString(),
): Sheet {
  return {
    ...structuredClone(sheet),
    id: `sheet-${id}`,
    title: `${sheet.title} (copy)`,
    updatedAt: now,
    openedAt: now,
  };
}
