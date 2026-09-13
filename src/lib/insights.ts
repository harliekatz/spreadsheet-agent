/**
 * One meaningful line per saved sheet, for the library.
 *
 * A list of sheets that all say "100 rows" tells a merchandiser nothing. These
 * read the sheet's own rows and surface the fact someone opened it for: how
 * many products need restocking, how much promotable revenue is sitting there,
 * how many vendors are short.
 *
 * Every figure is computed from the sheet in front of you, so nothing here can
 * drift away from what the grid shows.
 */

import type { Sheet } from "./types";

export type SheetInsight = {
  text: string;
  tone: "neutral" | "attention" | "positive";
};

const money = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};

const sum = (sheet: Sheet, field: string) =>
  sheet.rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);

const countWhere = (sheet: Sheet, field: string, test: (value: unknown) => boolean) =>
  sheet.rows.filter((row) => test(row[field])).length;

const has = (sheet: Sheet, field: string) => sheet.columns.includes(field);

/** The single most useful fact about this sheet, or null if there isn't one. */
export function sheetInsight(sheet: Sheet): SheetInsight | null {
  if (!sheet.rows.length) return { text: "No matching products", tone: "attention" };

  if (has(sheet, "Inventory")) {
    const out = countWhere(sheet, "Inventory", (v) => Number(v) === 0);
    const low = countWhere(sheet, "Inventory", (v) => Number(v) > 0 && Number(v) < 50);
    if (out > 0)
      return {
        text: `${out.toLocaleString()} out of stock, ${low.toLocaleString()} low`,
        tone: "attention",
      };
    if (low > 0)
      return {
        text: `${low.toLocaleString()} need restocking`,
        tone: "attention",
      };
  }

  if (has(sheet, "Product Image Status")) {
    const missing = countWhere(sheet, "Product Image Status", (v) => v === "Missing");
    if (missing > 0)
      return {
        text: `${missing.toLocaleString()} missing images`,
        tone: "attention",
      };
  }

  if (has(sheet, "Promotion Eligible") && has(sheet, "30 Day Revenue")) {
    const eligible = sheet.rows.filter((row) => row["Promotion Eligible"] === "Yes");
    const revenue = eligible.reduce(
      (total, row) => total + (Number(row["30 Day Revenue"]) || 0),
      0,
    );
    if (eligible.length)
      return { text: `${money(revenue)} in eligible revenue`, tone: "positive" };
  }

  if (has(sheet, "Vendor") && has(sheet, "Inventory")) {
    const vendors = new Set(sheet.rows.map((row) => String(row.Vendor)));
    const short = [...vendors].filter((vendor) => {
      const rows = sheet.rows.filter((row) => row.Vendor === vendor);
      const belowTarget = rows.filter((row) => Number(row.Inventory) < 100).length;
      return belowTarget / rows.length > 0.5;
    });
    if (short.length)
      return {
        text: `${short.length} of ${vendors.size} vendors below coverage`,
        tone: "attention",
      };
  }

  if (has(sheet, "30 Day Revenue")) {
    const revenue = sum(sheet, "30 Day Revenue");
    if (revenue > 0) return { text: `${money(revenue)} 30-day revenue`, tone: "neutral" };
  }

  if (has(sheet, "Margin Percent")) {
    const average = sum(sheet, "Margin Percent") / Math.max(sheet.rows.length, 1);
    return { text: `${average.toFixed(0)}% average margin`, tone: "neutral" };
  }

  if (has(sheet, "Vendor")) {
    const vendors = new Set(sheet.rows.map((row) => String(row.Vendor)));
    if (vendors.size > 1) return { text: `${vendors.size} vendors`, tone: "neutral" };
  }

  return null;
}

/** Short description of where a sheet's rows came from. */
export function sheetSource(sheet: Sheet): string {
  if (sheet.sourceFile) return `Imported from ${sheet.sourceFile}`;
  const filters = sheet.plan?.filters ?? [];
  if (filters.length) return filters.map((clause) => clause.label).join(" · ");
  return "Northwind product catalog";
}
