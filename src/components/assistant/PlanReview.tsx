"use client";

import { useState } from "react";
import { ArrowRight, Check, Database, Pencil, Plus, X } from "lucide-react";
import { availableFields } from "@/lib/query";
import { dataset } from "@/lib/data";
import type { Field, QueryPlan } from "@/lib/types";

const SOURCE_LABEL: Record<QueryPlan["source"], string> = {
  catalog: "Northwind product catalog",
  sheet: "The sheet currently open",
  document: "Your imported document",
};

/**
 * The plan, before anything is written to the sheet.
 *
 * This is the review step: a merchandiser reads what the assistant intends to
 * do, changes anything that is wrong, and only then approves it. Nothing
 * reaches the grid until Build sheet is pressed.
 */
export function PlanReview({
  plan,
  matchedRows,
  busy,
  onChange,
  onBuild,
  onDiscard,
}: {
  plan: QueryPlan;
  matchedRows: number;
  busy: boolean;
  onChange: (patch: Partial<QueryPlan>) => void;
  onBuild: () => void;
  onDiscard: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const remaining = availableFields(plan);
  const sortableFields = plan.columns.map((column) => column.field);

  const removeFilter = (index: number) =>
    onChange({ filters: plan.filters.filter((_, i) => i !== index) });

  const removeColumn = (field: Field) =>
    onChange({ columns: plan.columns.filter((column) => column.field !== field) });

  const addColumn = (field: Field) => {
    if (!field) return;
    onChange({
      columns: [
        ...plan.columns,
        { field, reason: "requested", sourcePath: `northwind.catalog.products[].${field}` },
      ],
    });
    setAdding(false);
  };

  return (
    <section className="plan-review" aria-labelledby="plan-review-title">
      <header className="plan-review-head">
        <div>
          <p className="eyebrow">Review before building</p>
          <h2 id="plan-review-title">Build plan</h2>
        </div>
        <button
          type="button"
          className={`button quiet plan-edit-toggle ${editing ? "is-active" : ""}`}
          aria-pressed={editing}
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Pencil size={14} aria-hidden="true" />
          )}
          {editing ? "Done editing" : "Edit plan"}
        </button>
      </header>

      <dl className="plan-rows">
        <div className="plan-row">
          <dt>Source</dt>
          <dd>
            <span className="plan-source">
              <Database size={13} aria-hidden="true" />
              {SOURCE_LABEL[plan.source]}
            </span>
            <span className="plan-note">
              {dataset.recordCount.toLocaleString()} synthetic records · approved for this
              workspace
            </span>
          </dd>
        </div>

        <div className="plan-row">
          <dt>Filters</dt>
          <dd>
            {plan.filters.length ? (
              <ul className="plan-chips">
                {plan.filters.map((clause, index) => (
                  <li key={`${clause.field}-${index}`} className="plan-chip">
                    <span>{clause.label}</span>
                    {editing && (
                      <button
                        type="button"
                        className="chip-remove"
                        aria-label={`Remove filter ${clause.label}`}
                        onClick={() => removeFilter(index)}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="plan-empty">No filters. Every product is included.</span>
            )}
          </dd>
        </div>

        <div className="plan-row">
          <dt>Columns</dt>
          <dd>
            <ul className="plan-chips">
              {plan.columns.map((column) => (
                <li key={column.field} className="plan-chip">
                  <span>{column.field}</span>
                  {editing && plan.columns.length > 1 && (
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={`Remove column ${column.field}`}
                      onClick={() => removeColumn(column.field)}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
              {editing && remaining.length > 0 && (
                <li>
                  {adding ? (
                    <select
                      className="plan-add-select"
                      autoFocus
                      defaultValue=""
                      aria-label="Add a column"
                      onChange={(event) => addColumn(event.target.value)}
                      onBlur={() => setAdding(false)}
                    >
                      <option value="" disabled>
                        Choose a field
                      </option>
                      {remaining.map((field) => (
                        <option key={field}>{field}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      className="plan-chip plan-chip-add"
                      onClick={() => setAdding(true)}
                    >
                      <Plus size={12} aria-hidden="true" />
                      Add column
                    </button>
                  )}
                </li>
              )}
            </ul>
          </dd>
        </div>

        <div className="plan-row">
          <dt>Sort</dt>
          <dd>
            {editing ? (
              <div className="plan-controls">
                <select
                  aria-label="Sort column"
                  value={plan.sort?.field ?? ""}
                  onChange={(event) =>
                    onChange({
                      sort: event.target.value
                        ? {
                            field: event.target.value,
                            direction: plan.sort?.direction ?? "asc",
                            matchedPhrase: "",
                          }
                        : undefined,
                    })
                  }
                >
                  <option value="">No sorting</option>
                  {sortableFields.map((field) => (
                    <option key={field}>{field}</option>
                  ))}
                </select>
                {plan.sort && (
                  <select
                    aria-label="Sort direction"
                    value={plan.sort.direction}
                    onChange={(event) =>
                      onChange({
                        sort: {
                          ...plan.sort!,
                          direction: event.target.value as "asc" | "desc",
                        },
                      })
                    }
                  >
                    <option value="asc">A to Z, low to high</option>
                    <option value="desc">Z to A, high to low</option>
                  </select>
                )}
              </div>
            ) : plan.sort ? (
              <>
                <span>
                  {plan.sort.field},{" "}
                  {plan.sort.direction === "asc" ? "ascending" : "descending"}
                </span>
                {!plan.sort.matchedPhrase && (
                  <span className="plan-note">Default order, change it if you like</span>
                )}
              </>
            ) : (
              <span className="plan-empty">Catalog order</span>
            )}
          </dd>
        </div>

        <div className="plan-row">
          <dt>Row limit</dt>
          <dd>
            {editing ? (
              <div className="plan-controls">
                <input
                  type="number"
                  min={1}
                  max={dataset.recordCount}
                  aria-label="Maximum rows"
                  value={plan.limit ?? ""}
                  placeholder="No limit"
                  onChange={(event) =>
                    onChange({
                      limit: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
                {plan.limit !== undefined && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onChange({ limit: undefined })}
                  >
                    Remove limit
                  </button>
                )}
              </div>
            ) : (
              <span>
                {plan.limit !== undefined
                  ? `First ${plan.limit.toLocaleString()} rows`
                  : "All matching rows"}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {plan.unmatchedTerms.length > 0 && (
        <p className="plan-warning" role="note">
          <strong>Not used:</strong> {plan.unmatchedTerms.join(", ")}. These words did not
          map to a field or filter, so they had no effect on the plan.
        </p>
      )}

      <footer className="plan-review-foot">
        <p className="plan-result">
          <strong className="tabular">{matchedRows.toLocaleString()}</strong> rows ·{" "}
          <strong className="tabular">{plan.columns.length}</strong> columns
        </p>
        <div className="plan-actions">
          <button
            type="button"
            className="button quiet"
            onClick={onDiscard}
            disabled={busy}
          >
            Discard
          </button>
          <button
            type="button"
            className="button primary"
            onClick={onBuild}
            disabled={busy || !plan.columns.length}
          >
            Build sheet
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  );
}
