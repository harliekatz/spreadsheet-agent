/**
 * Request interpreter.
 *
 * This is a deterministic rule-based planner, not a language model. It runs in
 * two separate phases so the mechanism stays inspectable:
 *
 *   1. `buildPlan()` turns a request into a structured `QueryPlan`. It reads no
 *      rows. It only decides which filters, sort, limit and columns apply.
 *   2. `executePlan()` applies that plan to a set of rows.
 *
 * The plan is rendered in the UI and attached to every generated sheet, so any
 * value in the grid can be traced back to the clause that selected its row and
 * the dataset field that supplied its value.
 *
 * A server-side planner (LLM or otherwise) could replace phase 1 without
 * touching phase 2, the grid, or the provenance layer. That is the whole point
 * of keeping the boundary here.
 */

import {
  catalog,
  dataset,
  fieldByName,
  fieldMeta,
  products,
  restockWindow,
  vendors,
} from "./data";
import type {
  ColumnPlan,
  Field,
  FilterClause,
  Product,
  QueryPlan,
  QueryResult,
  Sheet,
  SortClause,
} from "./types";

export type InterpretOptions = {
  /** When present, the request edits this sheet instead of creating one. */
  sheet?: Sheet;
  /** Explicit column list typed into the composer's Columns field. */
  columns?: string;
  /** Extra row criteria typed into the composer's Rows field. */
  rowCriteria?: string;
};

const BASE_COLUMNS: Field[] = ["SKU", "Product Name", "Vendor", "Category"];

const STOP_WORDS = new Set(
  (
    "a an and the of for with show me all list create make build sheet spreadsheet " +
    "report please that those these products product items only just in on by " +
    "to from is are was were which their our new add show"
  )
    .split(" ")
    .filter(Boolean),
);

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/’/g, "'")
    .replace(/percent/g, "%")
    .replace(/\s+/g, " ")
    .trim();

const sourcePathFor = (field: Field) =>
  fieldByName.get(field)?.path ?? `sheet.columns["${field}"]`;

/* ------------------------------------------------------------------ */
/* Field name matching                                                 */
/* ------------------------------------------------------------------ */

const aliasIndex = fieldMeta
  .flatMap((meta) => meta.aliases.map((alias) => ({ field: meta.name, alias })))
  .sort((a, b) => b.alias.length - a.alias.length);

/** Field names explicitly mentioned in a phrase, longest alias first. */
export function mentionedFields(phrase: string): Field[] {
  let remaining = ` ${normalize(phrase)} `;
  const found: Field[] = [];
  for (const { field, alias } of aliasIndex) {
    const pattern = new RegExp(
      `\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "g",
    );
    if (pattern.test(remaining)) {
      if (!found.includes(field)) found.push(field);
      remaining = remaining.replace(pattern, " ");
    }
  }
  return found;
}

/** Parse a comma or "and" separated list of column names. */
export function parseColumnList(input: string): {
  fields: Field[];
  unknown: string[];
} {
  const parts = input
    .split(/,|\band\b|\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const fields: Field[] = [];
  const unknown: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    const match =
      fieldMeta.find((meta) => meta.name.toLowerCase() === key) ??
      fieldMeta.find((meta) => meta.aliases.includes(key));
    if (!match) unknown.push(part);
    else if (!fields.includes(match.name)) fields.push(match.name);
  }
  return { fields, unknown };
}

/* ------------------------------------------------------------------ */
/* Filter clause builders                                              */
/* ------------------------------------------------------------------ */

const clause = (
  field: Field,
  operator: FilterClause["operator"],
  value: FilterClause["value"],
  label: string,
  matchedPhrase: string,
): FilterClause => ({ field, operator, value, label, matchedPhrase });

const COMPARATORS: Record<string, FilterClause["operator"]> = {
  under: "lt",
  below: "lt",
  "less than": "lt",
  "<": "lt",
  "at most": "lte",
  "<=": "lte",
  above: "gt",
  over: "gt",
  "greater than": "gt",
  ">": "gt",
  "at least": "gte",
  ">=": "gte",
};

const COMPARATOR_PATTERN =
  "under|below|less than|at most|<=|<|above|over|greater than|at least|>=|>";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every numeric field is comparable, using its own aliases. Longest aliases
 * first so "units sold" wins over "units".
 */
const NUMERIC_TARGETS: [Field, string][] = fieldMeta
  .filter((meta) => ["number", "currency", "percent"].includes(meta.type))
  .map((meta) => {
    const words = [meta.name, ...meta.aliases]
      .map((alias) => alias.toLowerCase())
      .sort((a, b) => b.length - a.length)
      .map(escapeRegex);
    return [meta.name, `(?:${words.join("|")})`] as [Field, string];
  });

function numericClauses(text: string): FilterClause[] {
  const clauses: FilterClause[] = [];
  for (const [field, word] of NUMERIC_TARGETS) {
    const forward = new RegExp(
      `${word}\\s*(?:is |of |levels? )?(${COMPARATOR_PATTERN})\\s*\\$?([\\d,.]+)`,
      "g",
    );
    const reverse = new RegExp(
      `(${COMPARATOR_PATTERN})\\s*\\$?([\\d,.]+)\\s*(?:%\\s*)?${word}`,
      "g",
    );
    for (const match of [...text.matchAll(forward), ...text.matchAll(reverse)]) {
      const operator = COMPARATORS[match[1]];
      const value = Number(match[2].replace(/,/g, ""));
      if (!operator || !Number.isFinite(value)) continue;
      clauses.push(
        clause(field, operator, value, `${field} ${match[1]} ${value}`, match[0].trim()),
      );
    }
  }
  return clauses;
}

/** Detect ranges that can never match, so the user gets a fixable message. */
function impossibleRange(clauses: FilterClause[]): Field | null {
  const byField = new Map<Field, FilterClause[]>();
  for (const c of clauses) {
    if (typeof c.value !== "number") continue;
    byField.set(c.field, [...(byField.get(c.field) ?? []), c]);
  }
  for (const [field, group] of byField) {
    let lower = -Infinity;
    let upper = Infinity;
    let strictLower = false;
    let strictUpper = false;
    for (const c of group) {
      const n = Number(c.value);
      if (c.operator === "lt" || c.operator === "lte") {
        if (n < upper) {
          upper = n;
          strictUpper = c.operator === "lt";
        } else if (n === upper) strictUpper ||= c.operator === "lt";
      } else if (c.operator === "gt" || c.operator === "gte") {
        if (n > lower) {
          lower = n;
          strictLower = c.operator === "gt";
        } else if (n === lower) strictLower ||= c.operator === "gt";
      }
    }
    if (lower > upper || (lower === upper && (strictLower || strictUpper))) return field;
  }
  return null;
}

function namedShortcuts(text: string): FilterClause[] {
  const out: FilterClause[] = [];
  const add = (c: FilterClause) => out.push(c);

  for (const vendor of vendors) {
    const first = vendor.split(" ")[0].toLowerCase();
    if (text.includes(vendor.toLowerCase()) || new RegExp(`\\b${first}\\b`).test(text))
      add(clause("Vendor", "equals", vendor, `Vendor is ${vendor}`, vendor.toLowerCase()));
  }

  const categories = [...new Set(products.map((row) => String(row.Category)))].sort(
    (a, b) => b.length - a.length,
  );
  for (const category of categories) {
    if (new RegExp(`\\b${category.toLowerCase()}\\b`).test(text)) {
      add(
        clause(
          "Category",
          "equals",
          category,
          `Category is ${category}`,
          category.toLowerCase(),
        ),
      );
      break;
    }
  }

  for (const sub of [...new Set(products.map((row) => String(row.Subcategory)))]) {
    const key = sub.toLowerCase();
    if (text.includes(key) || text.includes(key.replace(/s$/, ""))) {
      add(clause("Subcategory", "equals", sub, `Subcategory is ${sub}`, key));
      break;
    }
  }

  if (/low (inventory|stock)/.test(text))
    add(clause("Inventory", "lt", 50, "Inventory below 50", "low inventory"));
  if (/high (inventory|stock)/.test(text))
    add(clause("Inventory", "gte", 250, "Inventory at least 250", "high inventory"));
  if (/high[- ]margin/.test(text))
    add(clause("Margin Percent", "gt", 40, "Margin above 40%", "high margin"));
  if (/low[- ]margin/.test(text))
    add(clause("Margin Percent", "lt", 30, "Margin below 30%", "low margin"));

  if (/missing (product )?images?|without images?|image audit/.test(text))
    add(
      clause(
        "Product Image Status",
        "equals",
        "Missing",
        "Product images missing",
        "missing images",
      ),
    );
  else if (/images? (?:needs? review|review)/.test(text))
    add(
      clause(
        "Product Image Status",
        "equals",
        "Needs review",
        "Product images need review",
        "image review",
      ),
    );

  if (/\binactive\b/.test(text))
    add(clause("Product Status", "equals", "Inactive", "Product is inactive", "inactive"));
  else if (/\bactive products\b|product status active/.test(text))
    add(
      clause("Product Status", "equals", "Active", "Product is active", "active products"),
    );

  if (/(?:not|non)[ -]?(?:promotion|promo)[ -]?eligible|not eligible/.test(text))
    add(
      clause(
        "Promotion Eligible",
        "equals",
        "No",
        "Not eligible for promotion",
        "not promotion eligible",
      ),
    );
  else if (/promo|promotion/.test(text)) {
    if (/(?:promotion|promo) status.*active|active promo/.test(text))
      add(
        clause(
          "Promotion Status",
          "equals",
          "Active",
          "Promotion is active",
          "active promotion",
        ),
      );
    else if (/not scheduled|unscheduled/.test(text))
      add(
        clause(
          "Promotion Status",
          "equals",
          "Not scheduled",
          "Promotion not scheduled",
          "not scheduled",
        ),
      );
    else if (/planned|scheduled/.test(text))
      add(
        clause("Promotion Status", "equals", "Planned", "Promotion is planned", "planned"),
      );
    else
      add(
        clause(
          "Promotion Eligible",
          "equals",
          "Yes",
          "Eligible for promotion",
          "promotion eligible",
        ),
      );
  }

  if (/no restock|without (a )?restock/.test(text))
    add(clause("Restock Date", "isEmpty", "", "No restock scheduled", "no restock"));
  else {
    const explicit = /(before|after)\s*(\d{4}-\d{2}-\d{2})/.exec(text);
    if (explicit)
      add(
        clause(
          "Restock Date",
          explicit[1] === "before" ? "lt" : "gt",
          explicit[2],
          `Restock ${explicit[1]} ${explicit[2]}`,
          explicit[0],
        ),
      );
    else if (/upcoming restock|restock.*next|restocking/.test(text))
      add(
        clause(
          "Restock Date",
          "between",
          [restockWindow.from, restockWindow.to],
          `Restock between ${restockWindow.from} and ${restockWindow.to}`,
          "upcoming restocks",
        ),
      );
  }

  return out;
}

/** "vendor contains north", "product name contains tote". */
function containsClauses(text: string): FilterClause[] {
  const out: FilterClause[] = [];
  for (const match of text.matchAll(/([a-z0-9 %]+?)\s+contains\s+([^,;]+)/g)) {
    const field = mentionedFields(match[1])[0];
    const value = match[2].trim().replace(/^["“]|["”]$/g, "");
    if (!field || !value) continue;
    out.push(
      clause(field, "contains", value, `${field} contains "${value}"`, match[0].trim()),
    );
  }
  return out;
}

function sortClause(text: string): SortClause | undefined {
  const explicit = /(?:sort(?:ed)?(?: by)?|order(?:ed)?(?: by)?)\s+(.+)/.exec(text);
  const descendingPhrase = /highest to lowest|descending|high to low|largest|z to a/;
  const ascendingPhrase = /lowest to highest|ascending|low to high|smallest|a to z/;

  if (explicit) {
    const field = mentionedFields(explicit[1])[0];
    if (field)
      return {
        field,
        direction: ascendingPhrase.test(text) ? "asc" : "desc",
        matchedPhrase: explicit[0].trim(),
      };
  }
  if (/high revenue|top(?: \d+)? revenue|best selling|top sellers/.test(text))
    return { field: "30 Day Revenue", direction: "desc", matchedPhrase: "top revenue" };
  if (descendingPhrase.test(text) || ascendingPhrase.test(text)) {
    const field = mentionedFields(text)[0];
    if (field)
      return {
        field,
        direction: ascendingPhrase.test(text) ? "asc" : "desc",
        matchedPhrase: text.match(descendingPhrase)?.[0] ?? text.match(ascendingPhrase)![0],
      };
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Column selection                                                    */
/* ------------------------------------------------------------------ */

const INTENT_COLUMNS: {
  test: RegExp;
  title: string;
  columns: Field[];
}[] = [
  {
    test: /margin|pricing|cost|retail|price/,
    title: "Vendor Pricing and Margin",
    columns: ["SKU", "Product Name", "Vendor", "Cost", "Retail Price", "Margin Percent"],
  },
  {
    test: /promo|promotion/,
    title: "Promotion Candidates",
    columns: [
      "SKU",
      "Product Name",
      "Category",
      "Retail Price",
      "Margin Percent",
      "30 Day Revenue",
      "Promotion Eligible",
      "Promotion Status",
    ],
  },
  {
    test: /revenue|units sold|best selling|top sellers/,
    title: "Product Revenue Report",
    columns: [...BASE_COLUMNS, "30 Day Units Sold", "30 Day Revenue", "Margin Percent"],
  },
  {
    test: /images?|image audit/,
    title: "Product Image Audit",
    columns: [...BASE_COLUMNS, "Product Image Status", "Product Status"],
  },
  {
    test: /inventory|stock|restock/,
    title: "Inventory Report",
    columns: [...BASE_COLUMNS, "Inventory", "Restock Date", "Availability Status"],
  },
];

function titleFor(text: string, filters: FilterClause[]): string {
  const vendor = filters.find((f) => f.field === "Vendor");
  const category = filters.find((f) => f.field === "Category");
  const subcategory = filters.find((f) => f.field === "Subcategory");

  // Name the sheet the way a merchandiser would: the noun they used, applied to
  // whatever the request narrowed down to.
  const noun = /assortment/.test(text)
    ? "Assortment"
    : /catalog/.test(text)
      ? "Catalog"
      : /audit/.test(text)
        ? "Audit"
        : /report/.test(text)
          ? "Report"
          : "";
  const scope = /\bb2b\b/.test(text) ? "B2B " : "";

  if (category && noun) return `${scope}${category.value} ${noun}`;
  if (subcategory && noun) return `${scope}${subcategory.value} ${noun}`;
  if (vendor) return `${String(vendor.value).split(" ")[0]} Vendor ${noun || "Report"}`;
  if (category) return `${scope}${category.value} Catalog`;
  if (subcategory) return `${scope}${subcategory.value} Catalog`;
  for (const intent of INTENT_COLUMNS) if (intent.test.test(text)) return intent.title;
  return noun ? `Product ${noun}` : "Product Sheet";
}

function unmatchedTerms(text: string, consumed: string[]): string[] {
  let remaining = text;
  for (const phrase of consumed) remaining = remaining.split(phrase).join(" ");
  return [
    ...new Set(
      remaining
        .replace(/[^a-z0-9%\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)),
    ),
  ].slice(0, 8);
}

/* ------------------------------------------------------------------ */
/* Plan execution                                                      */
/* ------------------------------------------------------------------ */

const compare = (a: unknown, b: unknown) => {
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn) && a !== "" && b !== "") return an - bn;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true });
};

export function matchesClause(row: Product, filter: FilterClause): boolean {
  const raw = row[filter.field];
  switch (filter.operator) {
    case "equals":
      return String(raw) === String(filter.value);
    case "notEquals":
      return String(raw) !== String(filter.value);
    case "contains":
      return String(raw ?? "")
        .toLowerCase()
        .includes(String(filter.value).toLowerCase());
    case "isEmpty":
      return raw === undefined || raw === "";
    case "notEmpty":
      return raw !== undefined && raw !== "";
    case "between": {
      const [from, to] = filter.value as [string, string];
      return raw !== undefined && raw !== "" && String(raw) >= from && String(raw) <= to;
    }
    case "lt":
      return compare(raw, filter.value) < 0;
    case "lte":
      return compare(raw, filter.value) <= 0;
    case "gt":
      return raw !== "" && compare(raw, filter.value) > 0;
    case "gte":
      return raw !== "" && compare(raw, filter.value) >= 0;
    default:
      return true;
  }
}

export function executePlan(plan: QueryPlan, rows: Product[]): Product[] {
  let output = rows.filter((row) => plan.filters.every((f) => matchesClause(row, f)));
  if (plan.sort) {
    const { field, direction } = plan.sort;
    const factor = direction === "asc" ? 1 : -1;
    output = [...output].sort((a, b) => compare(a[field], b[field]) * factor);
  }
  if (plan.limit !== undefined) output = output.slice(0, plan.limit);
  return output;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

class RequestError extends Error {}

const emptyPlan = (request: string, source: QueryPlan["source"]): QueryPlan => ({
  request,
  datasetId: dataset.id,
  source,
  intent: "create",
  filters: [],
  columns: [],
  unmatchedTerms: [],
  scannedRows: 0,
  matchedRows: 0,
  interpretedAt: new Date().toISOString(),
});

export function interpret(request: string, options: InterpretOptions = {}): QueryResult {
  const { sheet, columns: explicitColumns = "", rowCriteria = "" } = options;
  const text = normalize(`${request} ${rowCriteria}`);
  const editing = !!sheet;
  const source: QueryPlan["source"] = sheet?.sourceFile
    ? "document"
    : editing
      ? "sheet"
      : "catalog";
  const sourceRows = sheet ? sheet.rows : products;

  const plan: QueryPlan = {
    ...emptyPlan(request, source),
    intent: editing ? "filter" : "create",
    datasetId: sheet?.datasetId ?? dataset.id,
    scannedRows: sourceRows.length,
  };

  const fail = (message: string): QueryResult => ({
    title: sheet?.title ?? "Product Sheet",
    columns: sheet?.columns ?? [...BASE_COLUMNS],
    rows: sheet?.rows ?? [],
    action: plan.intent,
    summary: message,
    error: message,
    plan,
  });

  try {
    /* ---- imported documents: structural commands only ---- */
    if (sheet?.sourceFile) {
      const sort = /\bsort(?: by)?\s+(.+)/.exec(text);
      const sortField = sheet.columns.find((c) => sort?.[1].includes(c.toLowerCase()));
      if (sort && sortField) {
        plan.intent = "sort";
        plan.sort = {
          field: sortField,
          direction: /ascending|lowest|a to z|low to high/.test(text) ? "asc" : "desc",
          matchedPhrase: sort[0].trim(),
        };
        plan.columns = sheet.columns.map((field) => ({
          field,
          reason: "imported" as const,
          sourcePath: `document["${sheet.sourceFile}"].${field}`,
        }));
        const rows = executePlan(plan, sheet.rows).map((row) => ({ ...row }));
        plan.matchedRows = rows.length;
        return {
          title: sheet.title,
          columns: sheet.columns,
          rows,
          action: "sort",
          summary: `Sorted by ${sortField}, ${plan.sort.direction === "asc" ? "ascending" : "descending"}.`,
          plan,
        };
      }
      const removable = sheet.columns.filter((c) => text.includes(c.toLowerCase()));
      if (/^(remove|drop|delete)\b/.test(text) && removable.length) {
        const remaining = sheet.columns.filter((c) => !removable.includes(c));
        if (!remaining.length) throw new RequestError("Keep at least one column.");
        plan.intent = "remove";
        plan.columns = remaining.map((field) => ({
          field,
          reason: "imported" as const,
          sourcePath: `document["${sheet.sourceFile}"].${field}`,
        }));
        plan.matchedRows = sheet.rows.length;
        return {
          title: sheet.title,
          columns: remaining,
          rows: sheet.rows,
          action: "remove",
          summary: `Removed ${removable.join(", ")}.`,
          plan,
        };
      }
      throw new RequestError(
        "This sheet came from your own document, so it is not connected to the catalog. You can edit cells directly, sort by a column name, or remove a column.",
      );
    }

    /* ---- add / remove columns on an existing sheet ---- */
    if (editing && /\b(add|insert|include)\b/.test(text)) {
      const requested = mentionedFields(
        text.replace(/\b(add|insert|include|as a column|columns?|the)\b/g, " "),
      );
      if (!requested.length)
        throw new RequestError(
          "Name a field to add, for example “Add vendor contact as a column”.",
        );
      const next = [...new Set([...sheet.columns, ...requested])];
      plan.intent = "add";
      plan.matchedRows = sheet.rows.length;
      plan.columns = next.map((field) => ({
        field,
        reason: requested.includes(field) ? "requested" : "existing",
        sourcePath: sourcePathFor(field),
      }));
      return {
        title: sheet.title,
        columns: next,
        rows: sheet.rows,
        action: "add",
        summary: `Added ${requested.join(", ")}.`,
        plan,
      };
    }

    if (editing && /\b(remove|drop|delete)\b/.test(text)) {
      const requested = mentionedFields(
        text.replace(/\b(remove|drop|delete|columns?|the)\b/g, " "),
      );
      if (!requested.length)
        throw new RequestError(
          "Name a column to remove, for example “Remove promotion status”.",
        );
      const next = sheet.columns.filter((c) => !requested.includes(c));
      if (!next.length) throw new RequestError("Keep at least one column in your sheet.");
      plan.intent = "remove";
      plan.matchedRows = sheet.rows.length;
      plan.columns = next.map((field) => ({
        field,
        reason: "existing",
        sourcePath: sourcePathFor(field),
      }));
      return {
        title: sheet.title,
        columns: next,
        rows: sheet.rows,
        action: "remove",
        summary: `Removed ${requested.join(", ")}.`,
        plan,
      };
    }

    /* ---- filters ---- */
    if (/low (inventory|stock)/.test(text) && /high (inventory|stock)/.test(text))
      throw new RequestError(
        "Choose either low or high inventory, or give a numeric range such as “inventory between 50 and 250”.",
      );

    const filters = [
      ...namedShortcuts(text),
      ...numericClauses(text),
      ...containsClauses(text),
    ];
    const conflict = impossibleRange(filters);
    if (conflict)
      throw new RequestError(
        `The ${conflict.toLowerCase()} limits in this request conflict, so no product could match. Adjust them to describe a possible range.`,
      );
    plan.filters = filters;

    /* ---- sort and limit ---- */
    const sort = sortClause(text);
    if (sort) plan.sort = sort;
    // "top 25" implies a ranking; "limit to 100" / "first 100" is just a cap.
    const ranked = /\btop\s+(\d+)\b/.exec(text);
    const capped =
      /\b(?:limit(?:ed)?(?: it)?(?: to)?|first|up to|max(?:imum)? of)\s+(\d+)\b/.exec(text);
    if (ranked) plan.limit = Number(ranked[1]);
    else if (capped) plan.limit = Number(capped[1]);

    /* ---- columns ---- */
    const explicit = parseColumnList(explicitColumns);
    if (explicitColumns.trim() && explicit.unknown.length)
      throw new RequestError(
        `These column names are not in the dataset: ${explicit.unknown.join(", ")}. Try SKU, Product Name, Vendor, Cost, Retail Price, Inventory or Restock Date.`,
      );

    let columns: ColumnPlan[];
    if (explicit.fields.length) {
      columns = explicit.fields.map((field) => ({
        field,
        reason: "requested" as const,
        sourcePath: sourcePathFor(field),
      }));
    } else if (editing) {
      columns = sheet.columns.map((field) => ({
        field,
        reason: "existing" as const,
        sourcePath: sourcePathFor(field),
      }));
    } else {
      const intent = INTENT_COLUMNS.find((entry) => entry.test.test(text));
      const chosen = intent ? intent.columns : BASE_COLUMNS;
      columns = chosen.map((field) => ({
        field,
        reason: intent ? ("intent" as const) : ("base" as const),
        sourcePath: sourcePathFor(field),
      }));
    }

    /* Always show the fields the request actually filtered or sorted on. */
    for (const field of [...filters.map((f) => f.field), ...(sort ? [sort.field] : [])]) {
      if (!columns.some((c) => c.field === field) && fieldByName.has(field))
        columns.push({
          field,
          reason: sort?.field === field ? "sort" : "intent",
          sourcePath: sourcePathFor(field),
        });
    }
    /* A created sheet with no stated ordering gets a readable default, shown in
       the plan as a default rather than as something the request asked for. */
    if (!editing && !plan.sort && columns.some((c) => c.field === "Product Name"))
      plan.sort = { field: "Product Name", direction: "asc", matchedPhrase: "" };

    plan.columns = columns;

    /* ---- did we understand anything at all? ---- */
    const recognized = filters.length > 0 || !!sort || explicit.fields.length > 0;
    // Creating a sheet from scratch can fall back to "everything in the
    // catalog". Editing an existing sheet cannot: a command we did not
    // understand must never silently replace the user's rows.
    const describesWholeCatalog =
      !editing &&
      /products?|catalog|sheet|report|pricing|vendor|inventory|merchandising|everything|all/.test(
        text,
      );
    if (!recognized && !describesWholeCatalog)
      throw new RequestError(
        editing
          ? "That command did not match anything. Try a filter, “Add vendor contact”, or “Sort by margin highest to lowest”."
          : "Try describing products, a vendor, inventory levels, margins, promotions or image status. You can also name exact columns in the Columns field.",
      );

    plan.intent = editing ? (sort && !filters.length ? "sort" : "filter") : "create";

    // Anything that shaped the plan counts as understood, including the words
    // that chose columns, set the limit, or named the sheet.
    const consumed = [
      ...filters.map((f) => f.matchedPhrase),
      ...(sort ? [sort.matchedPhrase] : []),
      ...(ranked?.[0] ? [ranked[0]] : []),
      ...(capped?.[0] ? [capped[0]] : []),
      ...columns.flatMap((c) => [
        c.field.toLowerCase(),
        ...(fieldByName.get(c.field)?.aliases ?? []),
      ]),
      "b2b",
      "assortment",
      "catalog",
      "audit",
      "report",
      "rows",
      "columns",
    ];
    plan.unmatchedTerms = unmatchedTerms(text, consumed);

    // Copy the surviving rows. Without this the sheet holds references into the
    // shared catalog, and editing one cell would rewrite the dataset for every
    // other sheet built from the same record.
    const rows = executePlan(plan, sourceRows).map((row) => ({ ...row }));
    plan.matchedRows = rows.length;

    const parts = [
      ...filters.map((f) => f.label),
      ...(sort
        ? [
            `sorted by ${sort.field} ${sort.direction === "asc" ? "ascending" : "descending"}`,
          ]
        : []),
      ...(plan.limit !== undefined
        ? [plan.sort ? `top ${plan.limit}` : `limited to ${plan.limit} rows`]
        : []),
    ];

    return {
      title: sheet?.title ?? titleFor(text, filters),
      columns: columns.map((c) => c.field),
      rows,
      action: plan.intent,
      summary: parts.length ? parts.join(" · ") : "All catalog products",
      plan,
    };
  } catch (error) {
    if (error instanceof RequestError) return fail(error.message);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Running an edited plan                                              */
/* ------------------------------------------------------------------ */

/**
 * Execute a plan the user has reviewed and possibly changed in the UI.
 *
 * `interpret()` produces the first draft of a plan. Once a person edits it,
 * the original request no longer describes it, so the plan itself becomes the
 * source of truth and this is what runs.
 */
export function runPlan(plan: QueryPlan, sheet?: Sheet): QueryResult {
  const sourceRows = plan.source === "catalog" ? products : (sheet?.rows ?? []);
  const executed: QueryPlan = {
    ...plan,
    scannedRows: sourceRows.length,
    interpretedAt: new Date().toISOString(),
  };
  const rows = executePlan(executed, sourceRows).map((row) => ({ ...row }));
  executed.matchedRows = rows.length;

  const parts = [
    ...executed.filters.map((f) => f.label),
    ...(executed.sort
      ? [
          `sorted by ${executed.sort.field} ${
            executed.sort.direction === "asc" ? "ascending" : "descending"
          }`,
        ]
      : []),
    ...(executed.limit !== undefined
      ? [executed.sort ? `top ${executed.limit}` : `limited to ${executed.limit} rows`]
      : []),
  ];

  return {
    title: sheet?.title ?? titleFor(normalize(plan.request), executed.filters),
    columns: executed.columns.map((c) => c.field),
    rows,
    action: executed.intent,
    summary: parts.length ? parts.join(" \u00b7 ") : "All catalog products",
    plan: executed,
  };
}

/** Count rows an edited plan would return, without building the sheet. */
export function countForPlan(plan: QueryPlan, sheet?: Sheet): number {
  const sourceRows = plan.source === "catalog" ? products : (sheet?.rows ?? []);
  return executePlan(plan, sourceRows).length;
}

/** Fields that can still be added to a plan, for the column editor. */
export function availableFields(plan: QueryPlan): Field[] {
  const used = new Set(plan.columns.map((c) => c.field));
  return fieldMeta.map((m) => m.name).filter((name) => !used.has(name));
}

export { catalog, dataset, fieldMeta };
