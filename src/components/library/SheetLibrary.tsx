"use client";

import { FileSpreadsheet, RotateCcw, Search, Star, Trash2, Users } from "lucide-react";
import { displayValue } from "../sheet/SpreadsheetGrid";
import { sheetInsight } from "@/lib/insights";
import { FileActions, type FileActionProps } from "./FileActions";
import type { Sheet } from "@/lib/types";

const relativeDate = (iso: string) => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function SheetCard({
  sheet,
  open,
  folders,
  onUpdate,
  onDuplicate,
  onDelete,
  onToggleStar,
  onRestore,
  onPurge,
}: Omit<FileActionProps, "sheet"> & {
  sheet: Sheet;
  open: () => void;
  onToggleStar: (id: string) => void;
  onRestore?: (id: string) => void;
  onPurge?: (id: string) => void;
}) {
  const insight = sheetInsight(sheet);
  const columns = sheet.columns.slice(0, 5);
  const inBin = !!sheet.deletedAt;

  return (
    <li className={`sheet-card ${inBin ? "is-deleted" : ""}`}>
      <button
        type="button"
        className="sheet-card-open"
        onClick={open}
        disabled={inBin}
        aria-label={inBin ? `${sheet.title}, deleted` : `Open ${sheet.title}`}
      >
        {/* A miniature of the real grid: row numbers, column letters, cell
            borders. It should read as a spreadsheet at a glance. */}
        <span className="card-preview" aria-hidden="true">
          <span
            className="mini-sheet"
            style={{ ["--mini-cols" as string]: columns.length }}
          >
            <span className="mini-row mini-letters">
              <span />
              {columns.map((_, index) => (
                <span key={index}>{String.fromCharCode(65 + index)}</span>
              ))}
            </span>
            <span className="mini-row mini-header">
              <span>1</span>
              {columns.map((column) => (
                <span key={column}>{column}</span>
              ))}
            </span>
            {sheet.rows.slice(0, 9).map((row, index) => (
              <span className="mini-row" key={index}>
                <span>{index + 2}</span>
                {columns.map((column) => (
                  <span
                    key={column}
                    className={typeof row[column] === "number" ? "mini-num" : ""}
                  >
                    {displayValue(row[column], column)}
                  </span>
                ))}
              </span>
            ))}
          </span>
        </span>

        <span className="card-body">
          <span className="card-title">
            {sheet.starred && !inBin && (
              <Star size={13} className="card-star" aria-label="Starred" />
            )}
            {sheet.title}
          </span>
          {sheet.sharedBy && !inBin && (
            <span className="card-shared">
              <Users size={12} aria-hidden="true" />
              Shared by {sheet.sharedBy}
            </span>
          )}
          {/* One line of meaning, not three. The filter that built the sheet is
              already legible from its title and its columns. */}
          <span className="card-meta">
            {insight && (
              <span className={`status status-${insight.tone}`}>
                <span className="status-dot" aria-hidden="true" />
                {insight.text}
              </span>
            )}
            <span className="card-date tabular">{relativeDate(sheet.updatedAt)}</span>
          </span>
        </span>
      </button>

      {inBin ? (
        <div className="card-bin-actions">
          <button type="button" className="button" onClick={() => onRestore?.(sheet.id)}>
            <RotateCcw size={14} aria-hidden="true" />
            Restore
          </button>
          <button
            type="button"
            className="button danger"
            onClick={() => onPurge?.(sheet.id)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete forever
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={`card-star-toggle tip ${sheet.starred ? "is-starred" : ""}`}
            data-tip={sheet.starred ? "Remove star" : "Star this sheet"}
            aria-label={sheet.starred ? `Unstar ${sheet.title}` : `Star ${sheet.title}`}
            aria-pressed={!!sheet.starred}
            onClick={() => onToggleStar(sheet.id)}
          >
            <Star size={15} aria-hidden="true" />
          </button>
          <FileActions
            sheet={sheet}
            folders={folders}
            onUpdate={onUpdate}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </>
      )}
    </li>
  );
}

const DESCRIPTIONS: Record<string, string> = {
  "All Sheets": "Every sheet in this workspace, built from the Northwind catalog.",
  Recent: "Sheets you opened most recently.",
  Starred: "Sheets you pinned for quick access.",
  "Shared with me":
    "Sheets a colleague shared with you. Sharing is illustrative here: there are no accounts, and the names are fictional.",
  "Recently deleted": "Deleted sheets stay here until you remove them for good.",
};

export function SheetLibrary({
  view,
  sheets,
  deleted,
  folders,
  navigate,
  open,
  search,
  setSearch,
  onUpdate,
  onDuplicate,
  onDelete,
  onToggleStar,
  onRestore,
  onPurge,
  onEmptyTrash,
}: Omit<FileActionProps, "sheet"> & {
  view: string;
  sheets: Sheet[];
  deleted: Sheet[];
  navigate: (view: string) => void;
  open: (sheet: Sheet) => void;
  search: string;
  setSearch: (value: string) => void;
  onToggleStar: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onEmptyTrash: () => void;
}) {
  const inFolder = folders.includes(view);
  const inBin = view === "Recently deleted";
  const query = search.trim().toLowerCase();

  const source = inBin ? deleted : sheets;
  const filtered = source
    .filter((sheet) => (inFolder ? sheet.folder === view : true))
    .filter((sheet) => (view === "Starred" ? sheet.starred : true))
    .filter((sheet) => (view === "Shared with me" ? !!sheet.sharedBy : true))
    .filter((sheet) => !query || sheet.title.toLowerCase().includes(query))
    .slice()
    .sort((a, b) =>
      view === "Recent"
        ? b.openedAt.localeCompare(a.openedAt)
        : inBin
          ? (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "")
          : b.updatedAt.localeCompare(a.updatedAt),
    );

  return (
    <div className="library">
      <header className="library-header">
        <div>
          <h1>{view}</h1>
          <p>{DESCRIPTIONS[view] ?? `Sheets filed under ${view}.`}</p>
        </div>
        {inBin && filtered.length > 0 && (
          <button type="button" className="button danger" onClick={onEmptyTrash}>
            <Trash2 size={14} aria-hidden="true" />
            Empty bin
          </button>
        )}
        <label className="library-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search sheets</span>
          <input
            type="search"
            placeholder="Search sheets"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </header>

      {/* Folders are a filter, not a destination in their own right. */}
      {!inBin && view !== "Starred" && view !== "Shared with me" && (
        <div className="folder-filter" role="group" aria-label="Filter by folder">
          <button
            type="button"
            className={`folder-pill ${!inFolder ? "is-active" : ""}`}
            aria-pressed={!inFolder}
            onClick={() => navigate(view === "Recent" ? "Recent" : "All Sheets")}
          >
            All
          </button>
          {folders.map((folder) => {
            const count = sheets.filter((sheet) => sheet.folder === folder).length;
            return (
              <button
                key={folder}
                type="button"
                className={`folder-pill ${view === folder ? "is-active" : ""}`}
                aria-pressed={view === folder}
                onClick={() => navigate(folder)}
              >
                {folder}
                <span className="tabular">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length ? (
        <ul className="card-grid">
          {filtered.map((sheet) => (
            <SheetCard
              key={sheet.id}
              sheet={sheet}
              open={() => open(sheet)}
              folders={folders}
              onUpdate={onUpdate}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onToggleStar={onToggleStar}
              onRestore={onRestore}
              onPurge={onPurge}
            />
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          {inBin ? (
            <Trash2 size={26} aria-hidden="true" />
          ) : view === "Starred" ? (
            <Star size={26} aria-hidden="true" />
          ) : view === "Shared with me" ? (
            <Users size={26} aria-hidden="true" />
          ) : (
            <FileSpreadsheet size={26} aria-hidden="true" />
          )}
          <h3>
            {query
              ? "No sheets match that search"
              : inBin
                ? "The bin is empty"
                : view === "Starred"
                  ? "No starred sheets"
                  : view === "Shared with me"
                    ? "Nothing shared with you"
                    : "Nothing here yet"}
          </h3>
          <p>
            {query
              ? "Try a shorter search, or clear it to see everything."
              : inBin
                ? "Sheets you delete land here first, so nothing is lost by accident."
                : view === "Starred"
                  ? "Star a sheet from its card to keep it within reach."
                  : view === "Shared with me"
                    ? "Sheets a colleague shares with you would appear here."
                    : "Describe a sheet in the assistant and it appears here once built."}
          </p>
          {query && (
            <button type="button" className="button" onClick={() => setSearch("")}>
              Clear search
            </button>
          )}
        </div>
      )}

      <p className="library-footnote">
        All figures are computed from generated, fictional data.
      </p>
    </div>
  );
}
