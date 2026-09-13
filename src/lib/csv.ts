import Papa from "papaparse";
import type { Sheet } from "./types";

/**
 * CSV export.
 *
 * `escapeFormulae` prefixes values starting with = + - @ so a spreadsheet
 * application cannot be tricked into executing text from an imported document
 * as a formula. Only visible columns are exported; internal source ids are not.
 */
export const toCsv = (sheet: Sheet) =>
  Papa.unparse(
    {
      fields: sheet.columns,
      data: sheet.rows.map((row) => sheet.columns.map((column) => row[column] ?? "")),
    },
    { escapeFormulae: true },
  );

export const csvFileName = (title: string) =>
  `${title.replace(/[^a-z0-9 _-]/gi, "").trim() || "sheet"}.csv`;

export function downloadCsv(sheet: Sheet) {
  // The BOM keeps non-ASCII characters readable when opened in Excel.
  const blob = new Blob(["﻿" + toCsv(sheet)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = csvFileName(sheet.title);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
