"use client";

import { Check, LoaderCircle } from "lucide-react";

/**
 * The visible build sequence. Each label names work that actually happened,
 * and the whole thing is announced to assistive technology as it advances.
 */
export function BuildProgress({
  stage,
  stageIndex,
  stageCount,
}: {
  stage: string;
  stageIndex: number;
  stageCount: number;
}) {
  const complete = stageIndex >= stageCount && stage === "Sheet ready";
  const percent = Math.round((stageIndex / Math.max(stageCount, 1)) * 100);

  return (
    <div className={`build-progress ${complete ? "is-complete" : ""}`}>
      <div className="build-stage">
        {complete ? (
          <Check size={15} aria-hidden="true" />
        ) : (
          <LoaderCircle size={15} className="spin" aria-hidden="true" />
        )}
        <span>{stage}</span>
        <span className="build-step tabular">
          {stageIndex} of {stageCount}
        </span>
      </div>
      <div
        className="build-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={stageCount}
        aria-valuenow={stageIndex}
        aria-label="Build progress"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
