"use client";

import { forwardRef, useEffect, useMemo, useState } from "react";
import { cellSource, sourceIdOf } from "@/lib/provenance";
import { fieldByName } from "@/lib/data";
import type { CellValue, Field, Selection, Sheet } from "@/lib/types";

export const PAGE_SIZE = 100;
/** Columns shown when there is no sheet yet, enough to fill a desktop width. */
const BLANK_COLUMNS = 8;

export const columnLetter = (index: number) => {
  let out = "";
  let n = index;
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
};

const currencyFields = new Set(["Cost", "Retail Price", "30 Day Revenue"]);

export function displayValue(value: CellValue | undefined, field?: Field) {
  if (value === undefined || value === "") return "";
  if (typeof value !== "number") return value;
  if (field && currencyFields.has(field))
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  if (field === "Margin Percent") return `${value}%`;
  return value.toLocaleString("en-US");
}

/**
 * Relative column widths.
 *
 * Widths are percentages so the table always consumes the full width of the
 * workspace, however wide the assistant panel is. A minimum width on the table
 * keeps columns readable and hands overflow to the scroll container instead.
 */
const COLUMN_WEIGHT: Record<string, number> = {
  "Product Name": 2.4,
  "Vendor Contact": 2.2,
  Vendor: 1.6,
  Subcategory: 1.3,
  Category: 1.2,
  "Availability Status": 1.3,
  "Promotion Status": 1.3,
  "Product Image Status": 1.3,
  SKU: 0.9,
  Inventory: 0.8,
  Cost: 0.8,
  "Retail Price": 0.9,
  "Margin Percent": 0.9,
};

const weightFor = (field: Field | undefined): number =>
  (field ? COLUMN_WEIGHT[field] : undefined) ?? 1.1;

type GridProps = {
  sheet: Sheet;
  selection: Selection;
  select: (selection: Selection) => void;
  edit: (row: number, col: number, value: string) => void;
  busy: boolean;
};

export const SpreadsheetGrid = forwardRef<HTMLDivElement, GridProps>(
  function SpreadsheetGrid({ sheet, selection, select, edit, busy }, ref) {
    const [editing, setEditing] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [page, setPage] = useState(0);

    const hasData = sheet.columns.length > 0;
    const columnCount = hasData ? sheet.columns.length : BLANK_COLUMNS;
    const rowCount = hasData ? sheet.rows.length : 26;
    const lastPage = Math.max(0, Math.ceil(rowCount / PAGE_SIZE) - 1);
    const currentPage = Math.min(page, lastPage);
    const firstRow = currentPage * PAGE_SIZE;
    const visibleRows = Math.max(0, Math.min(PAGE_SIZE, rowCount - firstRow));
    const headerOffset = hasData ? 2 : 1;

    const widths = useMemo(() => {
      const weights = Array.from({ length: columnCount }, (_, index) =>
        weightFor(sheet.columns[index]),
      );
      const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
      return weights.map((weight) => `${((weight / total) * 100).toFixed(3)}%`);
    }, [sheet.columns, columnCount]);

    useEffect(() => setPage(Math.floor(selection.row / PAGE_SIZE)), [selection.row]);
    useEffect(() => {
      setEditing(null);
      setPage(0);
    }, [sheet.id]);

    const changePage = (next: number) => {
      setPage(next);
      select({ row: next * PAGE_SIZE, col: selection.col });
      requestAnimationFrame(() =>
        document
          .getElementById(`cell-${next * PAGE_SIZE}-${selection.col}`)
          ?.scrollIntoView({ block: "center" }),
      );
    };

    const startEditing = (row: number, col: number, initial?: string) => {
      if (busy || !sheet.rows[row] || !sheet.columns[col]) return;
      setDraft(initial ?? String(sheet.rows[row][sheet.columns[col]] ?? ""));
      setEditing(`${row}:${col}`);
    };

    const commitEdit = (row: number, col: number) => {
      edit(row, col, draft);
      setEditing(null);
    };

    const move = (row: number, col: number, key: string) => {
      const rowDelta =
        key === "ArrowDown" || key === "Enter" ? 1 : key === "ArrowUp" ? -1 : 0;
      const colDelta =
        key === "ArrowRight" || key === "Tab" ? 1 : key === "ArrowLeft" ? -1 : 0;
      const nextRow = Math.max(0, Math.min(Math.max(rowCount - 1, 0), row + rowDelta));
      const nextCol = Math.max(0, Math.min(columnCount - 1, col + colDelta));
      select({ row: nextRow, col: nextCol });
      setPage(Math.floor(nextRow / PAGE_SIZE));
      requestAnimationFrame(() =>
        document.getElementById(`cell-${nextRow}-${nextCol}`)?.focus(),
      );
    };

    return (
      <div className="grid-region">
        <div
          className="grid-scroll"
          ref={ref}
          aria-busy={busy}
          style={{
            // An empty grid has no content to protect, so it simply fills the
            // workspace. A populated one keeps a readable minimum per column
            // and hands any overflow to this scroll container.
            ["--grid-min-width" as string]: hasData
              ? `${columnCount * 104 + 44}px`
              : "100%",
          }}
        >
          <table
            className={`spreadsheet ${hasData ? "populated" : "blank"}`}
            role="grid"
            aria-label={hasData ? `${sheet.title} data` : "Empty spreadsheet"}
            aria-rowcount={sheet.rows.length + (hasData ? 1 : 0)}
            aria-colcount={columnCount}
          >
            <colgroup>
              <col className="row-number-col" />
              {widths.map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>

            <thead>
              <tr className="letter-row" role="row">
                <th className="corner" scope="col">
                  <span className="sr-only">Row</span>
                </th>
                {Array.from({ length: columnCount }, (_, c) => (
                  <th key={c} scope="col" data-col={c}>
                    {columnLetter(c)}
                  </th>
                ))}
              </tr>
              {hasData && (
                <tr className="data-header" role="row">
                  <th className="row-number" scope="row">
                    1
                  </th>
                  {sheet.columns.map((field, c) => {
                    const meta = fieldByName.get(field);
                    return (
                      <th
                        key={field}
                        scope="col"
                        data-col={c}
                        title={
                          meta?.derivedFrom
                            ? `${field} — calculated: ${meta.derivedFrom}`
                            : meta
                              ? `${field} — ${meta.description}`
                              : field
                        }
                        className={meta?.derivedFrom ? "is-derived" : ""}
                      >
                        <span className="cell-text">{field}</span>
                        {meta?.derivedFrom && (
                          <span className="derived-dot" aria-hidden="true" />
                        )}
                      </th>
                    );
                  })}
                </tr>
              )}
            </thead>

            <tbody>
              {Array.from({ length: visibleRows }, (_, i) => firstRow + i).map((r) => {
                const row = sheet.rows[r];
                const rowId = sourceIdOf(row) ?? `blank-${r}`;
                return (
                  <tr key={rowId} role="row" data-row-id={row ? rowId : undefined}>
                    <th className="row-number" scope="row">
                      {r + headerOffset}
                    </th>
                    {Array.from({ length: columnCount }, (_, c) => {
                      const field = sheet.columns[c];
                      const value = row?.[field];
                      const key = `${r}:${c}`;
                      const selected = selection.row === r && selection.col === c;
                      const style = sheet.formats?.[key];
                      const kind =
                        hasData && row && field
                          ? cellSource(sheet, r, field).kind
                          : "empty";
                      const address = `${columnLetter(c)}${r + headerOffset}`;
                      return (
                        <td
                          key={c}
                          id={`cell-${r}-${c}`}
                          role="gridcell"
                          data-col={c}
                          aria-label={
                            field ? `${field}, row ${r + headerOffset}` : `Cell ${address}`
                          }
                          aria-selected={selected}
                          aria-readonly={!row || !field}
                          tabIndex={selected ? 0 : -1}
                          className={[
                            "data-cell",
                            value !== undefined ? "filled" : "",
                            selected ? "selected-cell" : "",
                            typeof value === "number" ? "numeric" : "",
                            kind === "edited" ? "cell-edited" : "",
                            kind === "derived" ? "cell-derived" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={{
                            fontWeight: style?.bold ? 600 : undefined,
                            textAlign: style?.align,
                          }}
                          onClick={() => select({ row: r, col: c })}
                          onDoubleClick={() => startEditing(r, c)}
                          onKeyDown={(event) => {
                            if (editing) return;
                            const navigation = [
                              "ArrowDown",
                              "ArrowUp",
                              "ArrowLeft",
                              "ArrowRight",
                              "Tab",
                            ];
                            if (navigation.includes(event.key)) {
                              event.preventDefault();
                              move(r, c, event.key);
                            } else if (event.key === "Enter" || event.key === "F2") {
                              event.preventDefault();
                              startEditing(r, c);
                            } else if (
                              event.key === "Backspace" ||
                              event.key === "Delete"
                            ) {
                              event.preventDefault();
                              edit(r, c, "");
                            } else if (
                              event.key.length === 1 &&
                              !event.metaKey &&
                              !event.ctrlKey &&
                              !event.altKey
                            ) {
                              event.preventDefault();
                              startEditing(r, c, event.key);
                            }
                          }}
                        >
                          {editing === key ? (
                            <input
                              className="cell-editor"
                              aria-label={`Edit ${field ?? address}`}
                              autoFocus
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              onBlur={() => commitEdit(r, c)}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                                if (event.key === "Enter" || event.key === "Tab") {
                                  event.preventDefault();
                                  commitEdit(r, c);
                                  move(r, c, event.key);
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  setEditing(null);
                                }
                              }}
                            />
                          ) : (
                            <span className="cell-text">{displayValue(value, field)}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {hasData && sheet.rows.length === 0 && !busy && (
            <div className="grid-empty" role="status">
              <h3>No products match these rules</h3>
              <p>
                Every filter in the plan was applied and nothing was left. Undo the last
                change, widen a threshold, or start a new sheet.
              </p>
            </div>
          )}
        </div>

        {lastPage > 0 && (
          <nav className="grid-pagination" aria-label="Spreadsheet pages">
            <button
              type="button"
              className="button quiet"
              disabled={busy || currentPage === 0}
              onClick={() => changePage(currentPage - 1)}
            >
              Previous
            </button>
            <span aria-live="polite" className="tabular">
              Rows {(firstRow + 1).toLocaleString()}–
              {Math.min(firstRow + PAGE_SIZE, sheet.rows.length).toLocaleString()} of{" "}
              {sheet.rows.length.toLocaleString()}
            </span>
            <button
              type="button"
              className="button quiet"
              disabled={busy || currentPage === lastPage}
              onClick={() => changePage(currentPage + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </div>
    );
  },
);
