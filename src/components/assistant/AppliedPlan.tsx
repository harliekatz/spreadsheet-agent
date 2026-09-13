"use client";

import { useState } from "react";
import { ChevronDown, Database } from "lucide-react";
import type { QueryPlan } from "@/lib/types";

const SOURCE_LABEL: Record<QueryPlan["source"], string> = {
  catalog: "Northwind product catalog",
  sheet: "The sheet currently open",
  document: "Your imported document",
};

/**
 * The plan that produced the sheet on screen, collapsed by default once the
 * build is done. Its rules stay connected to the result: the row counts here
 * are the counts in the grid.
 */
export function AppliedPlan({ plan }: { plan: QueryPlan }) {
  const [open, setOpen] = useState(false);

  return (
    <section className={`applied-plan ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="applied-plan-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown size={15} aria-hidden="true" className="applied-chevron" />
        <span>Rules applied to this sheet</span>
        <span className="applied-count tabular">
          {plan.filters.length + (plan.sort ? 1 : 0) + (plan.limit !== undefined ? 1 : 0)}
        </span>
      </button>

      {open && (
        <div className="applied-plan-body">
          <dl className="plan-rows compact">
            <div className="plan-row">
              <dt>Source</dt>
              <dd>
                <span className="plan-source">
                  <Database size={13} aria-hidden="true" />
                  {SOURCE_LABEL[plan.source]}
                </span>
                <span className="plan-note tabular">
                  {plan.scannedRows.toLocaleString()} scanned ·{" "}
                  {plan.matchedRows.toLocaleString()} matched
                </span>
              </dd>
            </div>

            {plan.filters.length > 0 && (
              <div className="plan-row">
                <dt>Filters</dt>
                <dd>
                  <ul className="plan-chips">
                    {plan.filters.map((clause, index) => (
                      <li key={`${clause.field}-${index}`} className="plan-chip">
                        {clause.label}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}

            {plan.sort && (
              <div className="plan-row">
                <dt>Sort</dt>
                <dd>
                  {plan.sort.field},{" "}
                  {plan.sort.direction === "asc" ? "ascending" : "descending"}
                </dd>
              </div>
            )}

            {plan.limit !== undefined && (
              <div className="plan-row">
                <dt>Row limit</dt>
                <dd>First {plan.limit.toLocaleString()} rows</dd>
              </div>
            )}
          </dl>

          <details className="technical-detail">
            <summary>Technical detail</summary>
            <pre tabIndex={0}>
              <code>{JSON.stringify(plan, null, 2)}</code>
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
