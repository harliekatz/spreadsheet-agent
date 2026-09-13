"use client";

import { useState } from "react";
import { Database, FileUp, Info, PencilLine, Sigma } from "lucide-react";
import { cellSource, columnSource, rowSource } from "@/lib/provenance";
import type { Selection, Sheet } from "@/lib/types";
import { columnLetter } from "./SpreadsheetGrid";

const KIND_META = {
  dataset: { label: "Source data", Icon: Database },
  derived: { label: "Calculated", Icon: Sigma },
  edited: { label: "Your edit", Icon: PencilLine },
  document: { label: "From your file", Icon: FileUp },
  empty: { label: "Empty", Icon: Info },
} as const;

const COLUMN_REASON: Record<string, string> = {
  requested: "You named this column in the request.",
  intent: "Chosen because the request is about this topic.",
  base: "Default identifying column.",
  sort: "Included because the sheet is sorted by it.",
  existing: "Already present on the sheet.",
  imported: "Header taken from your imported document.",
};

export function FormulaBar({
  sheet,
  selection,
  edit,
  busy,
}: {
  sheet: Sheet;
  selection: Selection;
  edit: (row: number, col: number, value: string) => void;
  busy: boolean;
}) {
  const field = sheet.columns[selection.col];
  const value = sheet.rows[selection.row]?.[field] ?? "";
  const [draft, setDraft] = useState(String(value));
  const [syncKey, setSyncKey] = useState("");

  // Adjusting state during render is React's recommended alternative to an
  // effect for this, and avoids a second render pass on every selection change.
  const currentKey = `${selection.row}:${selection.col}:${String(value)}`;
  if (currentKey !== syncKey) {
    setSyncKey(currentKey);
    setDraft(String(value));
  }

  const editable = !busy && !!sheet.rows[selection.row] && !!field;

  return (
    <div className="formula-bar">
      <span className="cell-address tabular" aria-label="Selected cell">
        {columnLetter(selection.col)}
        {selection.row + (sheet.columns.length ? 2 : 1)}
      </span>
      <span className="fx" aria-hidden="true">
        fx
      </span>
      <input
        aria-label={field ? `Value of ${field}` : "Cell value"}
        disabled={!editable}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== String(value)) edit(selection.row, selection.col, draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            edit(selection.row, selection.col, draft);
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setDraft(String(value));
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

/**
 * Provenance for the selected cell, above the grid.
 *
 * Source data, calculated values and human edits are visually distinct here
 * and in the grid, so it is always clear which parts of a sheet came from the
 * catalog, which the assistant worked out, and which a person typed.
 */
export function CellDetail({ sheet, selection }: { sheet: Sheet; selection: Selection }) {
  const [open, setOpen] = useState(false);
  const field = sheet.columns[selection.col];
  const ready = sheet.columns.length > 0 && !!field && !!sheet.rows[selection.row];

  if (!ready) {
    return (
      <div className="cell-detail is-empty">
        <Info size={14} aria-hidden="true" />
        <span>Select a cell to trace where its value came from.</span>
      </div>
    );
  }

  const source = cellSource(sheet, selection.row, field);
  const column = columnSource(sheet, field);
  const row = rowSource(sheet, selection.row);
  const { label, Icon } = KIND_META[source.kind];

  const summary =
    source.kind === "dataset" || source.kind === "derived"
      ? source.field.path
      : source.kind === "document"
        ? `${source.file} · ${source.recordId}`
        : source.kind === "edited"
          ? source.previousValue !== undefined
            ? `replaced "${source.previousValue}"`
            : "no catalog value"
          : "";

  return (
    <div className={`cell-detail kind-${source.kind} ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="cell-detail-summary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="provenance-badge">
          <Icon size={13} aria-hidden="true" />
          {label}
        </span>
        <span className="cell-detail-path">{summary}</span>
        <span className="cell-detail-toggle">{open ? "Hide detail" : "Detail"}</span>
      </button>

      {open && (
        <dl className="cell-detail-body">
          {(source.kind === "dataset" || source.kind === "derived") && (
            <>
              <div>
                <dt>Dataset</dt>
                <dd>
                  {source.dataset.name} <code>v{source.dataset.version}</code>
                </dd>
              </div>
              <div>
                <dt>Record</dt>
                <dd>
                  <code>{source.recordId}</code>
                </dd>
              </div>
              <div>
                <dt>Field</dt>
                <dd>
                  <code>{source.field.path}</code>
                </dd>
              </div>
              <div>
                <dt>Definition</dt>
                <dd>{source.field.description}</dd>
              </div>
              {source.kind === "derived" && (
                <div>
                  <dt>Calculation</dt>
                  <dd>
                    <code>{source.formula}</code>
                  </dd>
                </div>
              )}
            </>
          )}

          {source.kind === "edited" && (
            <>
              <div>
                <dt>Current value</dt>
                <dd>{String(source.value) || <em>empty</em>}</dd>
              </div>
              <div>
                <dt>Catalog value</dt>
                <dd>
                  {source.previousValue === undefined ? (
                    <em>this column is not in the catalog</em>
                  ) : (
                    String(source.previousValue)
                  )}
                </dd>
              </div>
              <div>
                <dt>Note</dt>
                <dd>Edits are kept and exported. They never change the catalog.</dd>
              </div>
            </>
          )}

          {source.kind === "document" && (
            <>
              <div>
                <dt>File</dt>
                <dd>
                  <code>{source.file}</code>
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {source.recordId}, column &ldquo;{source.column}&rdquo;
                </dd>
              </div>
              <div>
                <dt>Note</dt>
                <dd>Read in your browser. The file was never uploaded.</dd>
              </div>
            </>
          )}

          {column.plan && (
            <div>
              <dt>Why this column</dt>
              <dd>{COLUMN_REASON[column.plan.reason] ?? column.plan.reason}</dd>
            </div>
          )}

          {row.clauses.length > 0 && (
            <div>
              <dt>Why this row</dt>
              <dd>
                <ul>
                  {row.clauses.map((clause, index) => (
                    <li key={`${clause.field}-${index}`}>{clause.label}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
