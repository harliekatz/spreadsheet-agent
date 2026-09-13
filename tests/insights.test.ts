import assert from "node:assert/strict";
import test from "node:test";
import { sheetInsight, sheetSource } from "../src/lib/insights";
import { sampleSheets } from "../src/lib/samples";
import { interpret } from "../src/lib/query";
import type { Sheet } from "../src/lib/types";

const sheetFrom = (request: string): Sheet => ({
  ...interpret(request),
  id: "insight-sheet",
  folder: "",
  updatedAt: "2026-09-01",
  openedAt: "2026-09-01",
});

test("every seeded sheet gets a result worth reading", () => {
  for (const sheet of sampleSheets) {
    const insight = sheetInsight(sheet);
    assert.ok(insight, `${sheet.title} has no insight`);
    assert.ok(insight.text.length > 0 && insight.text.length < 60, sheet.title);
  }
});

test("seeded sheets differ in size, so the size column means something", () => {
  const sizes = new Set(sampleSheets.map((sheet) => sheet.rows.length));
  assert.ok(sizes.size > 8, "sample sheets are too uniform to be useful");
});

test("a sheet's rows always agree with the plan that built it", () => {
  for (const sheet of sampleSheets)
    assert.equal(sheet.plan?.matchedRows, sheet.rows.length, sheet.title);
});

test("inventory sheets report stock problems, not generic counts", () => {
  const insight = sheetInsight(sheetFrom("low inventory products"));
  assert.match(insight!.text, /out of stock|need restocking/);
  assert.equal(insight!.tone, "attention");
});

test("money is formatted at a readable magnitude", () => {
  const insight = sheetInsight(sheetFrom("promotion eligible sorted by revenue"));
  assert.match(insight!.text, /^\$[\d.]+[KM] in eligible revenue$/);
});

test("an empty sheet says so rather than inventing a figure", () => {
  const empty = sheetFrom("products inventory under 0");
  assert.equal(sheetInsight(empty)?.text, "No matching products");
});

test("the source line describes the filters, or names the catalog", () => {
  assert.equal(sheetSource(sheetFrom("drinkware products")), "Category is Drinkware");
  assert.equal(sheetSource(sheetFrom("all products")), "Northwind product catalog");
  assert.match(
    sheetSource({ ...sheetFrom("all products"), sourceFile: "vendors.csv" }),
    /^Imported from vendors\.csv$/,
  );
});

test("the seed is versioned, so a stale copy in a browser cannot outlive it", async () => {
  const { SEED_VERSION } = await import("../src/lib/samples");
  assert.match(SEED_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test("the seed includes starred and shared sheets for those views", async () => {
  const starred = sampleSheets.filter((sheet) => sheet.starred);
  const shared = sampleSheets.filter((sheet) => sheet.sharedBy);
  assert.ok(starred.length >= 3, "Starred would open empty");
  assert.ok(shared.length >= 3, "Shared with me would open empty");
  for (const sheet of shared) assert.ok(sheet.sharedBy!.includes(" "), sheet.title);
});

test("nothing is seeded into the bin", () => {
  assert.equal(
    sampleSheets.filter((sheet) => sheet.deletedAt).length,
    0,
    "Recently deleted should start empty",
  );
});
