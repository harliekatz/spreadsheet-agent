/**
 * Captures the screenshots used in the README and docs, and fails on any
 * console error so it doubles as a smoke test of the main screens.
 *
 *   npm run build && npm start
 *   node scripts/screenshots.mjs [baseUrl] [outDir]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = process.argv[3] ?? "docs/screenshots";
await mkdir(outDir, { recursive: true });

// The container ships a Chromium that may not match this Playwright's expected
// revision, so point at it when it is there rather than downloading another.
const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch(
  existsSync(executablePath) ? { executablePath } : {},
);

const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console: ${m.text()}`);
});
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`  ${name}`);
};

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// 1. The empty workspace, where a request is typed.
await shot("start-state");

// 2. The library of seeded sheets.
await page.getByRole("button", { name: "All Sheets", exact: true }).click();
await shot("library");

// 3. A request interpreted into a plan, paused for review.
await page.getByRole("button", { name: "New sheet", exact: true }).click();
await page.waitForTimeout(400);
const prompt = page.locator("#agent-prompt");
await prompt.fill(
  "Build a B2B apparel assortment with SKU, product name, vendor and category. Limit it to 100 products.",
);
await page.getByRole("button", { name: "Send request" }).click();
await page.waitForTimeout(1400);
await shot("query-plan");

// 4. The sheet being built.
await page.getByRole("button", { name: /Build sheet/ }).click();
await page.waitForTimeout(500);
await shot("building");
await page.waitForTimeout(2600);
await shot("sheet");

// 5. A cell selected with the source panel expanded, showing the dataset,
//    record and field path behind the value.
//    data-col is zero based, so 0 is SKU, 1 Product Name, 2 Vendor, 3 Category.
const vendorCell = page.locator('td[data-col="2"] .cell-text').first();
await vendorCell.click();
await page.waitForTimeout(400);
const detail = page.getByRole("button", { name: /Detail|Show detail/ }).first();
if (await detail.count()) {
  await detail.click();
  await page.waitForTimeout(400);
}
await shot("source-reference");

// 6. A merchandising correction to a product name, with the original value
//    still reported in the source strip.
const nameCell = page.locator('td[data-col="1"]').first();
await nameCell.dblclick();
await page.waitForTimeout(300);
const editor = page.locator(".cell-editor");
if (await editor.count()) {
  await editor.fill("Charcoal Brushed Organic Cotton Tee");
  await editor.press("Enter");
  await page.waitForTimeout(500);
  await nameCell.locator(".cell-text").first().click();
  await page.waitForTimeout(500);
  await shot("edited-cell");
}

await browser.close();

if (problems.length > 0) {
  console.error(`\n${problems.length} console problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log("\nNo console errors.");
