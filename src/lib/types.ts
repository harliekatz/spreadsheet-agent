/**
 * Shared domain types.
 *
 * The important idea in this file is that a generated sheet carries its own
 * provenance. Every sheet knows which dataset it came from, which query plan
 * produced it, and every row keeps the id of the source record it was built
 * from. That is what makes `src/lib/provenance.ts` able to answer "where did
 * this number come from?" for any individual cell.
 */

/** Stable key used to trace a row back to its source record. */
export const SOURCE_ID = "__sourceId" as const;

export type CellValue = string | number;
export type Field = string;

/** A row. Domain fields plus a hidden source-record id. */
export type Product = Record<Field, CellValue>;

export type FieldType = "string" | "number" | "currency" | "percent" | "date" | "enum";

export type FieldMeta = {
  name: Field;
  /** Dotted path into the source dataset, shown in the source panel. */
  path: string;
  type: FieldType;
  description: string;
  enumValues?: string[];
  /** Set when the field is computed rather than stored. */
  derivedFrom?: string;
  aliases: string[];
};

export type DatasetMeta = {
  id: string;
  name: string;
  version: string;
  description: string;
  /** Always true here. The project ships no real data of any kind. */
  synthetic: true;
  generator: string;
  recordCount: number;
  referenceDate: string;
  fields: FieldMeta[];
};

/* ------------------------------------------------------------------ */
/* Query plan                                                          */
/* ------------------------------------------------------------------ */

export type FilterOperator =
  | "equals"
  | "notEquals"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "contains"
  | "isEmpty"
  | "notEmpty"
  | "between";

export type FilterClause = {
  field: Field;
  operator: FilterOperator;
  value: CellValue | [CellValue, CellValue];
  /** Human readable form, rendered in the plan and source panels. */
  label: string;
  /** The phrase in the request that produced this clause. */
  matchedPhrase: string;
};

export type SortClause = {
  field: Field;
  direction: "asc" | "desc";
  matchedPhrase: string;
};

export type ColumnPlan = {
  field: Field;
  /** Why this column is in the sheet. */
  reason: "requested" | "intent" | "base" | "sort" | "existing" | "imported";
  sourcePath: string;
};

export type PlanSource = "catalog" | "sheet" | "document";

/**
 * The structured plan the interpreter produced for one request. This is the
 * contract a real server-side planner would return, and it is rendered in the
 * UI so the mechanism is visible rather than implied.
 */
export type QueryPlan = {
  request: string;
  datasetId: string;
  source: PlanSource;
  intent: "create" | "add" | "remove" | "filter" | "sort";
  filters: FilterClause[];
  sort?: SortClause;
  limit?: number;
  columns: ColumnPlan[];
  /** Words in the request the parser did not understand. */
  unmatchedTerms: string[];
  scannedRows: number;
  matchedRows: number;
  interpretedAt: string;
};

export type QueryResult = {
  title: string;
  columns: Field[];
  rows: Product[];
  action: QueryPlan["intent"];
  summary: string;
  plan: QueryPlan;
  error?: string;
};

/* ------------------------------------------------------------------ */
/* Sheets                                                             */
/* ------------------------------------------------------------------ */

export type CellFormat = {
  bold?: boolean;
  align?: "left" | "center" | "right";
};

export type Sheet = {
  id: string;
  title: string;
  folder: string;
  columns: Field[];
  rows: Product[];
  updatedAt: string;
  openedAt: string;
  /** Dataset the rows came from, or `imported:<filename>`. */
  datasetId?: string;
  /** Plan that most recently shaped this sheet. */
  plan?: QueryPlan;
  /** Present when the sheet was built from a user-supplied document. */
  sourceFile?: string;
  formats?: Record<string, CellFormat>;
  /** Pinned by the user. */
  starred?: boolean;
  /** Set when the sheet is in Recently deleted rather than actually gone. */
  deletedAt?: string;
  /** Name of the (fictional) colleague who shared this sheet. */
  sharedBy?: string;
  /** Cells the user typed over, keyed `row:col` by source id and field. */
  edits?: Record<string, CellValue>;
};

export type Selection = { row: number; col: number };

export const folders = [
  "B2B Products",
  "Vendor Management",
  "Promotions",
  "Inventory",
  "Pricing",
  "Product Launches",
];
