import assert from "node:assert/strict";
import test from "node:test";
import {
  cellSource,
  columnSource,
  describeSource,
  editedCellCount,
  rowSource,
} from "../src/lib/provenance";
import { interpret } from "../src/lib/query";
import { extractText } from "../src/lib/importDocument";
import type { Sheet } from "../src/lib/types";

const sheetFrom = (request: string): Sheet => {
  const result = interpret(request);
  return {
    ...result,
    id: "provenance-sheet",
    folder: "",
    updatedAt: "2026-09-01",
    openedAt: "2026-09-01",
    datasetId: result.plan.datasetId,
  };
};

test("a generated value points at its dataset record and field path", () => {
  const sheet = sheetFrom("low inventory products");
  const source = cellSource(sheet, 0, "Inventory");
  assert.equal(source.kind, "dataset");
  if (source.kind !== "dataset") return;
  assert.equal(source.recordId, String(sheet.rows[0].SKU));
  assert.match(source.field.path, /^northwind\.catalog\.products\[\]\./);
  assert.equal(source.dataset.synthetic, true);
  assert.equal(source.value, sheet.rows[0].Inventory);
});

test("computed fields are reported as derived, with their formula", () => {
  const sheet = sheetFrom("high margin products");
  const source = cellSource(sheet, 0, "Margin Percent");
  assert.equal(source.kind, "derived");
  if (source.kind !== "derived") return;
  assert.match(source.formula, /Retail Price/);
  assert.match(describeSource(source), /^Computed:/);
});

test("an edited cell reports the dataset value it replaced", () => {
  const sheet = sheetFrom("products");
  const original = sheet.rows[0]["Product Name"];
  sheet.rows[0]["Product Name"] = "Renamed by hand";

  const source = cellSource(sheet, 0, "Product Name");
  assert.equal(source.kind, "edited");
  if (source.kind !== "edited") return;
  assert.equal(source.previousValue, original);
  assert.equal(editedCellCount(sheet), 1);
});

test("untouched sheets report no edits", () => {
  assert.equal(editedCellCount(sheetFrom("drinkware products")), 0);
});

test("imported values point at the file and row, never the catalog", () => {
  const document = extractText("vendors.csv", "Name,Count\nMug,20\nTote,3");
  const sheet: Sheet = {
    ...document,
    id: "imported",
    title: "vendors",
    folder: "",
    updatedAt: "",
    openedAt: "",
    sourceFile: "vendors.csv",
  };
  const source = cellSource(sheet, 1, "Name");
  assert.equal(source.kind, "document");
  if (source.kind !== "document") return;
  assert.equal(source.file, "vendors.csv");
  assert.equal(source.value, "Tote");
});

test("every row in a generated sheet satisfies every clause that selected it", () => {
  const sheet = sheetFrom("drinkware products with inventory under 50");
  for (let index = 0; index < Math.min(sheet.rows.length, 25); index += 1) {
    const source = rowSource(sheet, index);
    assert.ok(source.allMatched, `row ${index} does not satisfy the plan`);
    assert.ok(source.clauses.length >= 2);
  }
});

test("each column carries the reason the planner included it", () => {
  const sheet = sheetFrom("low inventory products");
  for (const column of sheet.columns) {
    const source = columnSource(sheet, column);
    assert.ok(source.plan, `${column} has no plan entry`);
    assert.ok(source.meta, `${column} has no field metadata`);
    assert.ok(source.meta!.description.length > 0);
  }
});

test("an empty cell is described rather than guessed at", () => {
  const sheet = sheetFrom("products");
  assert.equal(cellSource(sheet, 0, "Not A Field").kind, "empty");
});
