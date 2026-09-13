/**
 * Seeded library contents.
 *
 * These sheets are produced by running real requests through `interpret()` at
 * module load, so the demo library is never out of step with the interpreter.
 */

import { interpret } from "./query";
import { dayOffset } from "./data";
import type { Sheet } from "./types";

/**
 * Bump this whenever the seeded sheets change.
 *
 * The demo library is written into browser storage on first load, so without a
 * version stamp an old seed would survive every future change and the app would
 * keep showing data that no longer matches the code.
 */
export const SEED_VERSION = "2026-09-13";

const specs: [title: string, folder: string, request: string][] = [
  ["Low Inventory Report", "Inventory", "low inventory products limit to 250"],
  [
    "Fall Promotion Assortment",
    "Promotions",
    "promotion eligible products with margin above 40 limit to 120",
  ],
  ["Vendor Pricing Comparison", "Pricing", "vendor pricing sheet limit to 80"],
  ["B2B Drinkware Catalog", "B2B Products", "drinkware products limit to 200"],
  ["Products Missing Images", "Product Launches", "products missing images limit to 60"],
  ["High Margin Products", "Pricing", "high margin products limit to 150"],
  [
    "Northstar Vendor Inventory",
    "Vendor Management",
    "Northstar Supply inventory report limit to 45",
  ],
  [
    "Promotion Candidates",
    "Promotions",
    "promotion eligible sorted by revenue limit to 100",
  ],
  ["B2B Apparel Assortment", "B2B Products", "B2B apparel assortment limit to 175"],
  ["Restock Priority List", "Inventory", "products inventory below 100 limit to 90"],
  ["Top Revenue Products", "B2B Products", "top 25 revenue products"],
  ["Vendor Cost Review", "Vendor Management", "vendor pricing limit to 130"],
  ["Product Image Audit", "Product Launches", "image audit limit to 70"],
  ["Low Margin Review", "Pricing", "low margin products limit to 110"],
  ["Upcoming Restocks", "Inventory", "upcoming restocks limit to 55"],
  ["Unscheduled Promotions", "Promotions", "promotion status not scheduled limit to 95"],
];

/**
 * Fictional colleagues at the fictional company, so the Shared with me view has
 * something to show. There is no account system and no real sharing here.
 */
const sharedBy: Record<number, string> = {
  1: "Dana Whitfield",
  6: "Marcus Ali",
  12: "Priya Raman",
};

const starred = new Set([0, 8, 10]);

export const sampleSheets: Sheet[] = specs.map(([title, folder, request], index) => {
  const result = interpret(request);
  const timestamp = `${dayOffset(-(index % 6) - 1)}T${String(15 - (index % 7)).padStart(2, "0")}:20:00.000Z`;
  return {
    id: `sample-${index}`,
    title,
    folder,
    columns: result.columns,
    rows: result.rows,
    datasetId: result.plan.datasetId,
    plan: result.plan,
    updatedAt: timestamp,
    openedAt: timestamp,
    formats: {},
    ...(starred.has(index) ? { starred: true } : {}),
    ...(sharedBy[index] ? { sharedBy: sharedBy[index] } : {}),
  };
});
