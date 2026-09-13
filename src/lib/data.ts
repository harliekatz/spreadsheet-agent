/**
 * Synthetic dataset.
 *
 * Northwind Goods is a fictional B2B merchandise supplier invented for this
 * project. Every product, vendor, price and contact address below is generated
 * by the deterministic function at the bottom of this file. No real company,
 * catalog, customer or system is represented anywhere in this repository.
 *
 * The generator is deterministic on purpose: the same input always produces
 * the same catalog, so tests, screenshots and the live demo all agree.
 */

import type { DatasetMeta, FieldMeta, Product } from "./types";
import { SOURCE_ID } from "./types";

export const RECORD_COUNT = 1200;

/** Fixed "today" for the demo, so date filters do not rot over time. */
export const REFERENCE_DATE = "2026-09-01";

export const vendors = [
  "Northstar Supply",
  "Evergreen Merch Co",
  "Summit Promotional",
  "Brightline Products",
  "Atlas Goods",
  "Redwood Supply",
  "Pacific Merchandising",
];

const kinds: [string, string, string][] = [
  ["Drinkware", "Mugs", "Studio Ceramic Mug"],
  ["Drinkware", "Tumblers", "Trail Insulated Tumbler"],
  ["Drinkware", "Water Bottles", "Cove Steel Bottle"],
  ["Apparel", "T-Shirts", "Everyday Cotton Tee"],
  ["Apparel", "Hoodies", "Weekend Fleece Hoodie"],
  ["Bags", "Tote Bags", "Market Canvas Tote"],
  ["Office", "Notebooks", "Field Notes Journal"],
  ["Promotional Products", "Pens", "Contour Ballpoint Pen"],
  ["Tech Accessories", "Phone Accessories", "Orbit Phone Stand"],
  ["Accessories", "Travel Accessories", "Voyage Luggage Tag"],
  ["Home", "Blankets", "Hearth Woven Throw"],
  ["Office", "Desk Accessories", "Arc Desk Organizer"],
];

const colors = [
  "Sage",
  "Navy",
  "Natural",
  "Clay",
  "Charcoal",
  "Sky",
  "Stone",
  "Forest",
  "Cream",
];

const finishes = [
  "Classic",
  "Matte",
  "Gloss",
  "Textured",
  "Ribbed",
  "Brushed",
  "Heritage",
  "Compact",
  "Grande",
  "Softline",
  "Pro",
  "Traveler",
];

/* ------------------------------------------------------------------ */
/* Field metadata                                                      */
/* ------------------------------------------------------------------ */

const path = (key: string) => `northwind.catalog.products[].${key}`;

export const fieldMeta: FieldMeta[] = [
  {
    name: "SKU",
    path: path("sku"),
    type: "string",
    description: "Primary key of the catalog record.",
    aliases: ["sku", "item number", "product id"],
  },
  {
    name: "Product Name",
    path: path("name"),
    type: "string",
    description: "Display name, composed of colour, finish and product kind.",
    aliases: ["product name", "product", "name", "title"],
  },
  {
    name: "Category",
    path: path("category"),
    type: "enum",
    description: "Top level merchandising category.",
    enumValues: [...new Set(kinds.map((k) => k[0]))],
    aliases: ["category"],
  },
  {
    name: "Subcategory",
    path: path("subcategory"),
    type: "enum",
    description: "Second level category used for assortment planning.",
    enumValues: [...new Set(kinds.map((k) => k[1]))],
    aliases: ["subcategory", "sub category"],
  },
  {
    name: "Vendor",
    path: path("vendor.name"),
    type: "enum",
    description: "Supplier of record for the item.",
    enumValues: vendors,
    aliases: ["vendor", "supplier"],
  },
  {
    name: "Vendor SKU",
    path: path("vendor.sku"),
    type: "string",
    description: "Supplier's own identifier for the item.",
    aliases: ["vendor sku", "supplier sku"],
  },
  {
    name: "Cost",
    path: path("pricing.cost"),
    type: "currency",
    description: "Landed unit cost in USD.",
    aliases: ["cost", "unit cost"],
  },
  {
    name: "Retail Price",
    path: path("pricing.retail"),
    type: "currency",
    description: "List price in USD.",
    aliases: ["retail price", "retail", "price", "list price"],
  },
  {
    name: "Margin Percent",
    path: path("pricing.marginPercent"),
    type: "percent",
    description: "Gross margin on list price.",
    derivedFrom: "(Retail Price − Cost) ÷ Retail Price × 100",
    aliases: ["margin percent", "margin percentage", "margin"],
  },
  {
    name: "Inventory",
    path: path("inventory.onHand"),
    type: "number",
    description: "Units on hand across all warehouses.",
    aliases: ["inventory", "stock", "on hand"],
  },
  {
    name: "Restock Date",
    path: path("inventory.restockDate"),
    type: "date",
    description: "Next expected inbound receipt. Empty when none is scheduled.",
    aliases: ["restock date", "restock"],
  },
  {
    name: "Availability Status",
    path: path("inventory.status"),
    type: "enum",
    description: "Bucketed availability.",
    derivedFrom: "Inventory = 0 → Out of stock; < 100 → Low stock; else In stock",
    enumValues: ["In stock", "Low stock", "Out of stock"],
    aliases: ["availability status", "availability"],
  },
  {
    name: "Promotion Eligible",
    path: path("promotion.eligible"),
    type: "enum",
    description: "Whether vendor terms allow the item to be discounted.",
    enumValues: ["Yes", "No"],
    aliases: ["promotion eligible", "promotion eligibility", "promo eligible"],
  },
  {
    name: "Promotion Status",
    path: path("promotion.status"),
    type: "enum",
    description: "Current promotional state.",
    enumValues: ["Active", "Planned", "Not scheduled"],
    aliases: ["promotion status", "promo status"],
  },
  {
    name: "30 Day Units Sold",
    path: path("sales.units30d"),
    type: "number",
    description: "Units sold in the trailing 30 days.",
    aliases: ["30 day units sold", "30-day units sold", "units sold", "sales volume"],
  },
  {
    name: "30 Day Revenue",
    path: path("sales.revenue30d"),
    type: "currency",
    description: "Revenue in the trailing 30 days.",
    derivedFrom: "30 Day Units Sold × Retail Price",
    aliases: ["30 day revenue", "30-day revenue", "revenue"],
  },
  {
    name: "Product Image Status",
    path: path("content.imageStatus"),
    type: "enum",
    description: "Readiness of product photography.",
    enumValues: ["Complete", "Needs review", "Missing"],
    aliases: ["product image status", "image status", "images"],
  },
  {
    name: "Product Status",
    path: path("lifecycle.status"),
    type: "enum",
    description: "Whether the item is sellable.",
    enumValues: ["Active", "Inactive"],
    aliases: ["product status", "status"],
  },
  {
    name: "Last Updated",
    path: path("lifecycle.updatedAt"),
    type: "date",
    description: "Last write to the catalog record.",
    aliases: ["last updated", "updated"],
  },
  {
    name: "Vendor Contact",
    path: path("vendor.contactEmail"),
    type: "string",
    description:
      "Fictional mailbox on the reserved .example domain, which cannot receive mail.",
    aliases: ["vendor contact", "contact"],
  },
  {
    name: "Vendor Lead Time",
    path: path("vendor.leadTimeDays"),
    type: "number",
    description: "Days from purchase order to receipt.",
    aliases: ["vendor lead time", "lead time"],
  },
  {
    name: "Minimum Order Quantity",
    path: path("vendor.minimumOrderQuantity"),
    type: "number",
    description: "Smallest order the vendor accepts.",
    aliases: ["minimum order quantity", "moq"],
  },
];

export const fields: string[] = fieldMeta.map((f) => f.name);

export const fieldByName = new Map(fieldMeta.map((f) => [f.name, f]));

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

/** Days after REFERENCE_DATE, as an ISO date string. */
export function dayOffset(days: number): string {
  const base = new Date(`${REFERENCE_DATE}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`;
}

/** Inclusive window used by "upcoming restocks". */
export const restockWindow = { from: dayOffset(0), to: dayOffset(30) };

function buildProduct(i: number): Product {
  const [category, subcategory, kind] = kinds[i % kinds.length];
  const vendor = vendors[(i * 3 + Math.floor(i / 12)) % vendors.length];
  const retail = +(8 + ((i * 7) % 58) + 0.95).toFixed(2);
  const margin = 22 + ((i * 11) % 49);
  const cost = +(retail * (1 - margin / 100)).toFixed(2);
  const inventory = i % 17 === 0 ? 0 : (i * 37 + 9) % 460;
  const units = (i * 29 + 17) % 390;
  const color = colors[Math.floor(i / kinds.length) % colors.length];
  const finish = finishes[Math.floor(i / (kinds.length * colors.length)) % finishes.length];

  return {
    [SOURCE_ID]: `B2B-${1001 + i}`,
    SKU: `B2B-${1001 + i}`,
    "Product Name": `${color} ${finish} ${kind}`,
    Category: category,
    Subcategory: subcategory,
    Vendor: vendor,
    "Vendor SKU": `${vendor.slice(0, 3).toUpperCase()}-${4100 + i}`,
    Cost: cost,
    "Retail Price": retail,
    "Margin Percent": +(((retail - cost) / retail) * 100).toFixed(1),
    Inventory: inventory,
    "Restock Date": i % 5 === 0 ? "" : dayOffset(((i * 13) % 75) - 10),
    "Availability Status":
      inventory === 0 ? "Out of stock" : inventory < 100 ? "Low stock" : "In stock",
    "Promotion Eligible": i % 4 !== 0 ? "Yes" : "No",
    "Promotion Status": i % 7 === 0 ? "Active" : i % 3 === 0 ? "Planned" : "Not scheduled",
    "30 Day Units Sold": units,
    "30 Day Revenue": +(units * retail).toFixed(2),
    "Product Image Status":
      i % 6 === 0 ? "Missing" : i % 11 === 0 ? "Needs review" : "Complete",
    "Product Status": i % 13 === 0 ? "Inactive" : "Active",
    "Last Updated": dayOffset(-(i % 21) - 1),
    "Vendor Contact": `merch@${vendor.toLowerCase().replace(/\s/g, "")}.example`,
    "Vendor Lead Time": 7 + ((i * 3) % 35),
    "Minimum Order Quantity": [12, 24, 48, 72, 100][i % 5],
  };
}

export const products: Product[] = Array.from({ length: RECORD_COUNT }, (_, i) =>
  buildProduct(i),
);

/** Source record lookup, used for provenance and storage compression. */
export const catalog = new Map(products.map((row) => [String(row.SKU), row]));

export const dataset: DatasetMeta = {
  id: "northwind-catalog",
  name: "Northwind Goods product catalog",
  version: "1.0.0",
  description:
    "A fictional B2B merchandise catalog generated deterministically for this demo. Not derived from any real company's data.",
  synthetic: true,
  generator: "src/lib/data.ts",
  recordCount: RECORD_COUNT,
  referenceDate: REFERENCE_DATE,
  fields: fieldMeta,
};
