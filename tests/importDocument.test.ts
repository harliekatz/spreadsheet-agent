import assert from "node:assert/strict";
import test from "node:test";
import { extractText, fromMatrix, readDocument } from "../src/lib/importDocument";
import { interpret } from "../src/lib/query";
import { SOURCE_ID, type Sheet } from "../src/lib/types";

test("CSV extraction preserves quoted commas, identifiers and custom headers", () => {
  const document = extractText(
    "sample.csv",
    'Code,Description,Stock\n0012,"Mug, green",42',
  );
  assert.deepEqual(document.columns, ["Code", "Description", "Stock"]);
  assert.equal(document.rows[0].Code, "0012", "leading zeros must survive");
  assert.equal(document.rows[0].Description, "Mug, green");
});

test("labeled records become rows without inventing missing values", () => {
  const document = extractText(
    "sample.txt",
    "Product: Mug\nInventory: 40\n\nProduct: Tote",
  );
  assert.equal(document.rows.length, 2);
  assert.equal(document.rows[1].Inventory, "");
});

test("duplicate headers stay distinct and unstructured prose is refused", () => {
  assert.deepEqual(
    fromMatrix(
      "x",
      [
        ["Cost", "Cost"],
        ["2", "3"],
      ],
      "table",
    ).columns,
    ["Cost", "Cost 2"],
  );
  assert.throws(() => extractText("x", "This is unstructured prose."), /No structured/);
});

test("every imported row gets a traceable source id", () => {
  const document = extractText("sample.csv", "Name,Count\nMug,20\nTote,3");
  assert.equal(document.rows[0][SOURCE_ID], "row-2");
  assert.equal(document.rows[1][SOURCE_ID], "row-3");
});

test("unsupported file types and oversized files fail with a clear reason", async () => {
  await assert.rejects(readDocument(new File(["x"], "scan.pdf")), /not supported/);
  await assert.rejects(
    readDocument(new File([new Uint8Array(6 * 1024 * 1024)], "big.csv")),
    /5 MB/,
  );
});

test("imported sheets sort their own fields and never fall back to the catalog", () => {
  const document = extractText("x.csv", "Name,Count\nMug,20\nTote,3");
  const sheet = {
    ...document,
    id: "x",
    title: "x",
    folder: "",
    updatedAt: "",
    openedAt: "",
    sourceFile: "x.csv",
  } as Sheet;

  assert.equal(interpret("sort by Count ascending", { sheet }).rows[0].Name, "Tote");
  assert.match(interpret("show low inventory", { sheet }).error ?? "", /not connected/);
});
