import assert from "node:assert/strict";
import test from "node:test";
import Papa from "papaparse";
import { csvFileName, toCsv } from "../src/lib/csv";
import { interpret } from "../src/lib/query";
import { SOURCE_ID, type Sheet } from "../src/lib/types";

const sheetFrom = (request: string): Sheet => ({
  ...interpret(request),
  id: "csv-sheet",
  folder: "",
  updatedAt: "2026-09-01",
  openedAt: "2026-09-01",
});

test("export keeps edited values, column order and row count", () => {
  const sheet = sheetFrom("products inventory below 100");
  sheet.rows[0]["Product Name"] = 'Edited, "quoted" mug';

  const parsed = Papa.parse(toCsv(sheet), { header: true });
  assert.deepEqual(parsed.meta.fields, sheet.columns);
  assert.equal(parsed.data.length, sheet.rows.length);
  assert.equal(
    (parsed.data[0] as Record<string, string>)["Product Name"],
    'Edited, "quoted" mug',
  );
});

test("internal source ids never leak into the export", () => {
  const csv = toCsv(sheetFrom("drinkware products"));
  assert.ok(!csv.includes(SOURCE_ID));
});

test("formula-like text is neutralised so spreadsheets cannot execute it", () => {
  const sheet = sheetFrom("drinkware products");
  sheet.rows[0]["Product Name"] = '=HYPERLINK("http://example.test")';
  const line = toCsv(sheet).split("\n")[1];
  assert.ok(!/(^|,)"?=/.test(line), `formula was not escaped: ${line}`);
});

test("file names are stripped of characters that break downloads", () => {
  assert.equal(csvFileName("Q3 / Vendor: review*"), "Q3  Vendor review.csv");
  assert.equal(csvFileName("***"), "sheet.csv");
});
