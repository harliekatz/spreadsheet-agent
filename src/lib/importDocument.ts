import Papa from "papaparse";
import type { Product } from "./types";
import { SOURCE_ID } from "./types";
export type ImportedDocument = {
  name: string;
  columns: string[];
  rows: Product[];
  method: string;
};
export function fromMatrix(
  name: string,
  matrix: string[][],
  method: string,
): ImportedDocument {
  const nonempty = matrix.filter((row) => row.some((cell) => cell.trim()));
  if (nonempty.length < 2)
    throw new Error("The document needs a header and at least one data row.");
  if (nonempty[0].length > 30 || nonempty.length > 1001)
    throw new Error("Use a document with up to 30 columns and 1,000 rows.");
  const used = new Set<string>();
  const columns = nonempty[0].map((value, i) => {
    const base = value.trim() || `Column ${i + 1}`;
    let key = base,
      n = 2;
    while (used.has(key)) key = `${base} ${n++}`;
    used.add(key);
    return key;
  });
  if (columns.includes(SOURCE_ID))
    throw new Error(`Rename the reserved ${SOURCE_ID} column before importing.`);
  const rows = nonempty.slice(1).map(
    (row, index) =>
      ({
        ...Object.fromEntries(columns.map((c, i) => [c, row[i]?.trim() || ""])),
        [SOURCE_ID]: `row-${index + 2}`,
      }) as Product,
  );
  return { name, columns, rows, method };
}
export function extractText(name: string, text: string): ImportedDocument {
  const parsed = Papa.parse<string[]>(text.trim(), {
    skipEmptyLines: "greedy",
  });
  if (parsed.data[0]?.length > 1) {
    if (parsed.errors.some((e) => e.type === "Quotes"))
      throw new Error(
        "The file contains an incomplete quoted value. Check the document and try again.",
      );
    return fromMatrix(name, parsed.data, "Delimited table");
  }
  const blocks = text.trim().split(/\n\s*\n/);
  const records = blocks.map((block) => {
    const pairs = block.split("\n").map((line) => line.match(/^\s*([^:]{1,60}):\s*(.*)$/));
    return pairs.every(Boolean)
      ? Object.fromEntries(pairs.map((m) => [m![1].trim(), m![2].trim()]))
      : null;
  });
  if (records.length && records.every(Boolean)) {
    const columns = [...new Set(records.flatMap((r) => Object.keys(r!)))];
    return fromMatrix(
      name,
      [columns, ...records.map((r) => columns.map((c) => r![c] || ""))],
      "Labeled records",
    );
  }
  throw new Error(
    "No structured table or labeled records were found. Use a DOCX table, CSV, TSV, or text with one record per paragraph and labeled fields such as Product: and Inventory:. This build uses structured extraction only; there is no model in the loop.",
  );
}
export async function readDocument(file: File): Promise<ImportedDocument> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose a document smaller than 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.convertToHtml({
      arrayBuffer: await file.arrayBuffer(),
    });
    const doc = new DOMParser().parseFromString(result.value, "text/html");
    const table = doc.querySelector("table");
    if (table)
      return fromMatrix(
        file.name,
        Array.from(table.rows, (row) =>
          Array.from(row.cells, (cell) => cell.textContent || ""),
        ),
        "First document table",
      );
    return extractText(
      file.name,
      Array.from(doc.querySelectorAll("p"), (p) => p.textContent || "").join("\n\n"),
    );
  }
  if (!["csv", "tsv", "txt"].includes(ext || ""))
    throw new Error(
      "Choose a DOCX, CSV, TSV, or TXT document. PDF and image extraction are not supported yet.",
    );
  return extractText(file.name, await file.text());
}
