import assert from "node:assert/strict";
import test from "node:test";
import { executePlan, interpret, matchesClause, parseColumnList } from "../src/lib/query";
import { products, restockWindow } from "../src/lib/data";
import type { Sheet } from "../src/lib/types";

const asSheet = (request: string): Sheet => {
  const result = interpret(request);
  return {
    ...result,
    id: "test-sheet",
    folder: "Inventory",
    updatedAt: "2026-09-01",
    openedAt: "2026-09-01",
  };
};

test("combined filters all survive into the plan and the rows", () => {
  const result = interpret("Show drinkware products with inventory under 50");
  assert.ok(result.rows.length > 0);
  assert.ok(
    result.rows.every((r) => r.Category === "Drinkware" && Number(r.Inventory) < 50),
  );
  assert.equal(result.plan.filters.length, 2);
  assert.ok(result.columns.includes("Restock Date"));
  assert.equal(result.plan.matchedRows, result.rows.length);
  assert.equal(result.plan.scannedRows, products.length);
});

test("every filter clause records the phrase that produced it", () => {
  const result = interpret("promotion eligible products with margin above 40");
  for (const clause of result.plan.filters) {
    assert.ok(clause.matchedPhrase.length > 0, `${clause.field} has no matched phrase`);
    assert.ok(clause.label.length > 0);
  }
});

test("vendor filtering and revenue sorting", () => {
  const result = interpret("Show all Northstar Supply products sorted by revenue");
  assert.ok(result.rows.length > 1);
  assert.ok(result.rows.every((r) => r.Vendor === "Northstar Supply"));
  assert.equal(result.plan.sort?.field, "30 Day Revenue");
  assert.equal(result.plan.sort?.direction, "desc");
  assert.ok(
    result.rows.every(
      (row, i) =>
        !i || Number(result.rows[i - 1]["30 Day Revenue"]) >= Number(row["30 Day Revenue"]),
    ),
  );
});

test("top N applies only alongside a sort, and is recorded as a limit", () => {
  const limited = interpret("top 10 revenue products");
  assert.equal(limited.plan.limit, 10);
  assert.equal(limited.rows.length, 10);
  assert.equal(interpret("all products").plan.limit, undefined);
});

test("explicit columns override inferred ones", () => {
  const result = interpret("Make a sheet", {
    columns: "SKU, Cost, Retail Price, Inventory",
    rowCriteria: "inventory below 100",
  });
  assert.deepEqual(result.columns.slice(0, 4), [
    "SKU",
    "Cost",
    "Retail Price",
    "Inventory",
  ]);
  assert.ok(result.rows.every((r) => Number(r.Inventory) < 100));
  assert.ok(result.plan.columns.some((c) => c.reason === "requested"));
});

test("unknown column names are rejected with a usable message", () => {
  const result = interpret("Make a sheet", { columns: "SKU, Sparkle Factor" });
  assert.match(result.error ?? "", /Sparkle Factor/);
  assert.equal(result.rows.length, 0);
});

test("adding and removing columns keeps manual edits intact", () => {
  const sheet = asSheet("products");
  sheet.rows[0]["Product Name"] = "Manually edited";

  const added = interpret("Add vendor contact as a column", { sheet });
  assert.ok(added.columns.includes("Vendor Contact"));
  assert.equal(added.rows[0]["Product Name"], "Manually edited");
  assert.equal(added.plan.intent, "add");

  const removed = interpret("Remove vendor contact", { sheet: { ...sheet, ...added } });
  assert.ok(!removed.columns.includes("Vendor Contact"));
  assert.ok(removed.columns.includes("Vendor"));
});

test("an empty result is legitimate, an unparsed command is an error", () => {
  assert.equal(interpret("products inventory under 0").rows.length, 0);
  assert.equal(interpret("products inventory under 0").error, undefined);
  assert.ok(interpret("turn everything purple", { sheet: asSheet("products") }).error);
});

test("status, promotion, image and restock filters", () => {
  assert.ok(
    interpret("promotion eligible margin above 40").rows.every(
      (r) => r["Promotion Eligible"] === "Yes" && Number(r["Margin Percent"]) > 40,
    ),
  );
  assert.ok(
    interpret("products missing images").rows.every(
      (r) => r["Product Image Status"] === "Missing",
    ),
  );
  assert.ok(
    interpret("inactive products").rows.every((r) => r["Product Status"] === "Inactive"),
  );
  const restocks = interpret("upcoming restocks");
  assert.ok(restocks.rows.length > 0);
  assert.ok(
    restocks.rows.every(
      (r) =>
        String(r["Restock Date"]) >= restockWindow.from &&
        String(r["Restock Date"]) <= restockWindow.to,
    ),
  );
});

test("contains filtering works on text fields", () => {
  const result = interpret("products where vendor contains redwood");
  assert.ok(result.rows.length > 0);
  assert.ok(result.rows.every((r) => String(r.Vendor).toLowerCase().includes("redwood")));
});

test("descending and ascending sorts both order correctly", () => {
  for (const [phrase, direction] of [
    ["highest to lowest", -1],
    ["lowest to highest", 1],
  ] as const) {
    const result = interpret(`Sort by inventory ${phrase}`, { sheet: asSheet("products") });
    assert.ok(
      result.rows.every(
        (row, i) =>
          !i ||
          (Number(row.Inventory) - Number(result.rows[i - 1].Inventory)) * direction >= 0,
      ),
    );
  }
});

test("a threshold before the field name is understood", () => {
  const result = interpret("Create a promo sheet with products above 40 percent margin");
  assert.ok(result.rows.length > 0);
  assert.ok(result.rows.every((r) => Number(r["Margin Percent"]) > 40));
});

test("impossible ranges are refused rather than returning nothing", () => {
  assert.match(
    interpret("inventory under 50", { rowCriteria: "inventory above 100" }).error ?? "",
    /conflict/,
  );
  assert.match(interpret("margin under 40 and margin above 60").error ?? "", /conflict/);
});

test("compatible repeated thresholds are all applied", () => {
  const result = interpret("inventory above 20", { rowCriteria: "inventory under 100" });
  assert.equal(result.error, undefined);
  assert.ok(result.rows.length > 0);
  assert.ok(
    result.rows.every((r) => Number(r.Inventory) > 20 && Number(r.Inventory) < 100),
  );
});

test("unmatched words are reported instead of silently ignored", () => {
  const result = interpret("low inventory products with a purple gradient");
  assert.ok(result.plan.unmatchedTerms.includes("purple"));
});

test("parseColumnList separates known fields from unknown ones", () => {
  const parsed = parseColumnList("sku, margin, nonsense field");
  assert.deepEqual(parsed.fields, ["SKU", "Margin Percent"]);
  assert.deepEqual(parsed.unknown, ["nonsense field"]);
});

test("executePlan is a pure function of plan and rows", () => {
  const { plan } = interpret("inventory under 50");
  const once = executePlan(plan, products);
  const twice = executePlan(plan, products);
  assert.deepEqual(once, twice);
  assert.equal(products.length, 1200, "source rows must not be mutated");
});

test("matchesClause covers every operator it claims to support", () => {
  const row = { Inventory: 50, Vendor: "Atlas Goods", "Restock Date": "" };
  assert.ok(
    matchesClause(row, {
      field: "Inventory",
      operator: "lte",
      value: 50,
      label: "",
      matchedPhrase: "",
    }),
  );
  assert.ok(
    !matchesClause(row, {
      field: "Inventory",
      operator: "lt",
      value: 50,
      label: "",
      matchedPhrase: "",
    }),
  );
  assert.ok(
    matchesClause(row, {
      field: "Vendor",
      operator: "contains",
      value: "atlas",
      label: "",
      matchedPhrase: "",
    }),
  );
  assert.ok(
    matchesClause(row, {
      field: "Restock Date",
      operator: "isEmpty",
      value: "",
      label: "",
      matchedPhrase: "",
    }),
  );
});
