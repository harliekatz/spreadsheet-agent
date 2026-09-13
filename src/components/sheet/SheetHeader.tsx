"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownUp,
  Bold,
  Check,
  Download,
  Filter,
  FolderInput,
  PanelRightOpen,
  PencilLine,
  Redo2,
  Save,
  Sparkles,
  Undo2,
} from "lucide-react";
import { OverflowMenu } from "../OverflowMenu";
import type { CellFormat, Sheet } from "@/lib/types";

/**
 * One page header per sheet. Download and Save live here and nowhere else.
 */
export function SheetHeader({
  sheet,
  folders,
  isSaved,
  busy,
  editedCount,
  panelOpen,
  assistantStatus,
  onTitle,
  onFolder,
  onSave,
  onDownload,
  onOpenPanel,
}: {
  sheet: Sheet;
  folders: string[];
  isSaved: boolean;
  busy: boolean;
  editedCount: number;
  panelOpen: boolean;
  assistantStatus: string;
  onTitle: (title: string) => void;
  onFolder: (folder: string) => void;
  onSave: () => void;
  onDownload: () => void;
  onOpenPanel: () => void;
}) {
  const hasData = sheet.columns.length > 0;

  return (
    <header className="sheet-header">
      <div className="sheet-identity">
        <input
          className="sheet-title"
          aria-label="Sheet title"
          value={sheet.title}
          disabled={busy}
          onChange={(event) => onTitle(event.target.value)}
          onBlur={(event) => {
            if (!event.target.value.trim()) onTitle("Untitled sheet");
          }}
        />
        <div className="sheet-meta">
          <span className={isSaved ? "is-saved" : ""}>
            {isSaved ? (
              <>
                <Check size={12} aria-hidden="true" /> Saved
              </>
            ) : (
              "Not saved"
            )}
          </span>
          {hasData && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular">
                {sheet.rows.length.toLocaleString()} rows · {sheet.columns.length} columns
              </span>
            </>
          )}
          {editedCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="meta-edited">
                <PencilLine size={12} aria-hidden="true" />
                {editedCount} edited {editedCount === 1 ? "cell" : "cells"}
              </span>
            </>
          )}
          {hasData && (
            <label className="folder-select">
              <FolderInput size={13} aria-hidden="true" />
              <span className="sr-only">Folder</span>
              <select
                value={sheet.folder}
                onChange={(event) => onFolder(event.target.value)}
              >
                <option value="">No folder</option>
                {folders.map((folder) => (
                  <option key={folder}>{folder}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="sheet-header-actions">
        {hasData && (
          <>
            <button
              type="button"
              className="button header-action"
              disabled={busy}
              onClick={onDownload}
            >
              <Download size={15} aria-hidden="true" />
              Download CSV
            </button>
            <button
              type="button"
              className="button header-action"
              disabled={busy}
              onClick={onSave}
            >
              <Save size={15} aria-hidden="true" />
              Save a copy
            </button>
            <div className="header-overflow">
              <OverflowMenu
                items={[
                  {
                    label: "Download CSV",
                    icon: <Download size={15} aria-hidden="true" />,
                    onSelect: onDownload,
                    disabled: busy,
                  },
                  {
                    label: "Save a copy",
                    icon: <Save size={15} aria-hidden="true" />,
                    onSelect: onSave,
                    disabled: busy,
                  },
                ]}
              />
            </div>
          </>
        )}

        {!panelOpen && (
          <button
            type="button"
            className="assistant-control"
            onClick={onOpenPanel}
            aria-label="Open the assistant panel"
          >
            <Sparkles size={15} aria-hidden="true" />
            <span className="assistant-control-label">
              {assistantStatus || "Assistant"}
            </span>
            <PanelRightOpen size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}

export function SheetToolbar({
  undo,
  redo,
  canUndo,
  canRedo,
  bold,
  align,
  format,
  filter,
  sort,
  busy,
  hasSheet,
}: {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  bold: boolean;
  align?: CellFormat["align"];
  format: (patch: CellFormat) => void;
  filter: () => void;
  sort: () => void;
  busy: boolean;
  hasSheet: boolean;
}) {
  const alignments: [NonNullable<CellFormat["align"]>, typeof AlignLeft, string][] = [
    ["left", AlignLeft, "Align left"],
    ["center", AlignCenter, "Align center"],
    ["right", AlignRight, "Align right"],
  ];

  return (
    <div className="sheet-toolbar" role="toolbar" aria-label="Sheet actions">
      <button
        type="button"
        className="icon-button tip"
        data-tip="Undo"
        aria-label="Undo"
        disabled={!canUndo || busy}
        onClick={undo}
      >
        <Undo2 size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-button tip"
        data-tip="Redo"
        aria-label="Redo"
        disabled={!canRedo || busy}
        onClick={redo}
      >
        <Redo2 size={16} aria-hidden="true" />
      </button>

      <span className="toolbar-rule" role="separator" />

      <button
        type="button"
        className="icon-button tip"
        data-tip="Bold"
        aria-label="Bold"
        aria-pressed={bold}
        disabled={busy || !hasSheet}
        onClick={() => format({ bold: !bold })}
      >
        <Bold size={16} aria-hidden="true" />
      </button>
      {alignments.map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          className="icon-button tip"
          data-tip={label}
          aria-label={label}
          aria-pressed={align === value}
          disabled={busy || !hasSheet}
          onClick={() => format({ align: value })}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}

      <span className="toolbar-rule" role="separator" />

      <button
        type="button"
        className="icon-button tip"
        data-tip="Filter rows"
        aria-label="Filter rows"
        disabled={busy || !hasSheet}
        onClick={filter}
      >
        <Filter size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-button tip"
        data-tip="Sort sheet"
        aria-label="Sort sheet"
        disabled={busy || !hasSheet}
        onClick={sort}
      >
        <ArrowDownUp size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
