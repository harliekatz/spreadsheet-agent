"use client";

import { ArrowRight, Minus, Plus } from "lucide-react";
import type { PendingEdit } from "@/hooks/useGeneration";

/**
 * Confirmation step for a change to a sheet that already exists.
 *
 * Bulk changes are previewed rather than applied straight away, because
 * "remove promotion status" on a 1,200 row sheet is not something anyone
 * should discover after the fact.
 */
export function ChangePreview({
  edit,
  busy,
  onApply,
  onDiscard,
}: {
  edit: PendingEdit;
  busy: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const { result, rowDelta, columnDelta } = edit;

  const delta = (value: number, noun: string) => {
    if (value === 0) return null;
    const up = value > 0;
    return (
      <span className={`delta ${up ? "delta-up" : "delta-down"}`}>
        {up ? (
          <Plus size={12} aria-hidden="true" />
        ) : (
          <Minus size={12} aria-hidden="true" />
        )}
        {Math.abs(value).toLocaleString()} {noun}
        {Math.abs(value) === 1 ? "" : "s"}
      </span>
    );
  };

  return (
    <section className="change-preview" aria-labelledby="change-preview-title">
      <p className="eyebrow">Review change</p>
      <h2 id="change-preview-title">{result.summary}</h2>

      <div className="change-deltas">
        {delta(rowDelta, "row")}
        {delta(columnDelta, "column")}
        {rowDelta === 0 && columnDelta === 0 && (
          <span className="delta delta-none">Same rows and columns, reordered</span>
        )}
      </div>

      <p className="change-result tabular">
        Result: {result.rows.length.toLocaleString()} rows · {result.columns.length} columns
      </p>

      <div className="plan-actions">
        <button type="button" className="button quiet" onClick={onDiscard} disabled={busy}>
          Discard
        </button>
        <button type="button" className="button primary" onClick={onApply} disabled={busy}>
          Apply change
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
