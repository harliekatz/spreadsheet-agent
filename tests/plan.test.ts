import assert from "node:assert/strict";
import test from "node:test";
import { availableFields, countForPlan, interpret, runPlan } from "../src/lib/query";
import { products } from "../src/lib/data";
import type { QueryPlan } from "../src/lib/types";

const demoRequest =
  "Build a B2B apparel assortment with SKU, product name, vendor, and category. Limit it to 100 products.";

const planFor = (request: string): QueryPlan => interpret(request).plan;

test("the demo request produces exactly the documented plan", () => {
  const plan = planFor(demoRequest);
  assert.equal(plan.source, "catalog");
  assert.equal(plan.intent, "create");
  assert.deepEqual(
    plan.filters.map((clause) => clause.label),
    ["Category is Apparel"],
  );
  assert.deepEqual(
    plan.columns.map((column) => column.field),
    ["SKU", "Product Name", "Vendor", "Category"],
  );
  assert.equal(plan.sort?.field, "Product Name");
  assert.equal(plan.limit, 100);
  assert.equal(plan.matchedRows, 100);
  assert.deepEqual(plan.unmatchedTerms, [], "understood words must not be reported");
});

test("the built sheet matches the plan the user approved", () => {
  const result = runPlan(planFor(demoRequest));
  assert.equal(result.title, "B2B Apparel Assortment");
  assert.equal(result.rows.length, 100);
  assert.deepEqual(result.columns, ["SKU", "Product Name", "Vendor", "Category"]);
  assert.ok(result.rows.every((row) => row.Category === "Apparel"));
  assert.equal(result.plan.matchedRows, 100);
});

test("a limit applies without needing a sort", () => {
  const plan = planFor("all products limit to 40");
  assert.equal(plan.limit, 40);
  assert.equal(runPlan(plan).rows.length, 40);
});

test("editing the plan changes the result, and the request no longer governs", () => {
  const plan = planFor(demoRequest);
  const widened: QueryPlan = { ...plan, filters: [], limit: undefined };
  assert.equal(countForPlan(widened), products.length);
  assert.equal(runPlan(widened).rows.length, products.length);

  const narrowed: QueryPlan = {
    ...plan,
    filters: [
      ...plan.filters,
      {
        field: "Vendor",
        operator: "equals",
        value: "Atlas Goods",
        label: "Vendor is Atlas Goods",
        matchedPhrase: "",
      },
    ],
    limit: undefined,
  };
  const rows = runPlan(narrowed).rows;
  assert.ok(rows.length > 0 && rows.length < 100);
  assert.ok(
    rows.every((row) => row.Vendor === "Atlas Goods" && row.Category === "Apparel"),
  );
});

test("countForPlan agrees with the rows runPlan produces", () => {
  for (const request of [
    "low inventory products",
    "promotion eligible products with margin above 40",
    "top 25 revenue products",
    demoRequest,
  ]) {
    const plan = planFor(request);
    assert.equal(countForPlan(plan), runPlan(plan).rows.length, request);
  }
});

test("removing a column from the plan removes it from the sheet", () => {
  const plan = planFor(demoRequest);
  const withoutVendor: QueryPlan = {
    ...plan,
    columns: plan.columns.filter((column) => column.field !== "Vendor"),
  };
  assert.ok(!runPlan(withoutVendor).columns.includes("Vendor"));
});

test("availableFields offers only fields not already in the plan", () => {
  const plan = planFor(demoRequest);
  const offered = availableFields(plan);
  assert.ok(offered.length > 0);
  for (const column of plan.columns)
    assert.ok(!offered.includes(column.field), `${column.field} was offered twice`);
});

test("running a plan never mutates the catalog", () => {
  const before = JSON.stringify(products[0]);
  const result = runPlan(planFor(demoRequest));
  result.rows[0]["Product Name"] = "Changed after the fact";
  assert.equal(JSON.stringify(products[0]), before);
});
