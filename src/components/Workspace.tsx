"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Undo2, X } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { editedCellCount } from "@/lib/provenance";
import { fields } from "@/lib/data";
import type { Field, Sheet } from "@/lib/types";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useChats, type Chat } from "@/hooks/useChats";
import { useGeneration } from "@/hooks/useGeneration";
import { useAssistantPanel } from "@/hooks/useAssistantPanel";
import { Sidebar } from "./Sidebar";
import { SheetLibrary } from "./library/SheetLibrary";
import { SpreadsheetGrid } from "./sheet/SpreadsheetGrid";
import { CellDetail, FormulaBar } from "./sheet/CellDetail";
import { SheetHeader, SheetToolbar } from "./sheet/SheetHeader";
import { AssistantPanel } from "./assistant/AssistantPanel";
import { SheetDialog, type DialogKind } from "./SheetDialog";

const SHEET_VIEWS = ["New Sheet", "Open Sheet"];

export default function Workspace() {
  const workspace = useWorkspace();
  const chats = useChats();
  const panel = useAssistantPanel();

  const [navCollapsed, setNavCollapsed] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const grid = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isLibrary = !SHEET_VIEWS.includes(workspace.view);
  const hasSheet = workspace.sheet.columns.length > 0;

  const notify = useCallback((text: string, undo = false) => {
    setToast({ text, undo });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), undo ? 7000 : 3600);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const generation = useGeneration({
    workspace,
    remember: chats.remember,
    onBuildStart: useCallback(() => panel.setOpen(true), [panel]),
    onBuildComplete: useCallback(() => {
      workspace.setView("Open Sheet");
    }, [workspace]),
    // An assistant change is undoable, so it is announced with the way back.
    onChangeApplied: useCallback((summary: string) => notify(summary, true), [notify]),
  });

  /* Narrow desktops start with the rail, since the panel needs the room. */
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1200px)");
    const apply = () => narrow.matches && setNavCollapsed(true);
    apply();
    narrow.addEventListener("change", apply);
    return () => narrow.removeEventListener("change", apply);
  }, []);

  /* Navigation ---------------------------------------------------- */
  const startNewSheet = useCallback(() => {
    if (generation.busy) return;
    grid.current?.scrollTo({ left: 0, top: 0 });
    workspace.newSheet();
    generation.reset();
    panel.setOpen(true);
    setDraft("");
    setError("");
  }, [generation, workspace, panel]);

  const navigate = (view: string) => {
    setSearch("");
    workspace.setView(view);
    generation.reset();
    setDraft("");
    setError("");
  };

  const openSheet = (sheet: Sheet) => {
    workspace.open(sheet);
    generation.reset([
      {
        role: "assistant",
        text: `${sheet.title} is open with ${sheet.rows.length.toLocaleString()} rows. Ask for a change, or edit cells directly.`,
      },
    ]);
    generation.setActivePlan(sheet.plan);
    panel.setOpen(true);
    setDraft("");
    setError("");
  };

  /** Reopen a past conversation and the sheet it produced. */
  const openChat = (chat: Chat) => {
    const latest =
      workspace.saved.find((sheet: Sheet) => sheet.id === chat.sheet.id) ?? chat.sheet;
    workspace.open(latest);
    generation.reset(chat.messages);
    generation.setActivePlan(latest.plan);
    generation.setChatId(chat.id);
    panel.setOpen(true);
    setDraft("");
    setError("");
  };

  /* Actions ------------------------------------------------------- */
  const saveCopy = () => notify(`${workspace.saveCopy().title} saved.`);
  const download = () => {
    downloadCsv(workspace.sheet);
    notify("CSV downloaded.");
  };

  const submit = useCallback(async () => {
    const request = draft.trim();
    if (!request) return;
    setError("");
    const failure = hasSheet
      ? generation.proposeEdit(request)
      : await generation.propose(request);
    if (failure) setError(failure);
    else setDraft("");
  }, [draft, hasSheet, generation]);

  const editedCount = useMemo(
    () => (hasSheet ? editedCellCount(workspace.sheet) : 0),
    [workspace.sheet, hasSheet],
  );

  const selectionFormat =
    workspace.sheet.formats?.[`${workspace.selection.row}:${workspace.selection.col}`];

  const assistantStatus =
    generation.phase === "review"
      ? "Plan ready to review"
      : generation.busy
        ? generation.stage
        : "";

  return (
    <div
      className={[
        "app-shell",
        navCollapsed ? "nav-rail" : "nav-open",
        panel.open ? "panel-open" : "panel-closed",
      ].join(" ")}
      style={{ ["--assistant-width" as string]: `${panel.width}px` }}
    >
      <Sidebar
        collapsed={navCollapsed}
        toggle={() => setNavCollapsed((value) => !value)}
        view={
          !isLibrary && workspace.sheet.folder ? workspace.sheet.folder : workspace.view
        }
        folders={workspace.folders}
        navigate={navigate}
        newSheet={startNewSheet}
        addFolder={() => setDialog("folder")}
        busy={generation.busy}
        deletedCount={workspace.deleted.length}
      />

      <main id="workspace-main" className="workspace-main">
        {isLibrary ? (
          <SheetLibrary
            view={workspace.view}
            sheets={workspace.saved}
            deleted={workspace.deleted}
            folders={workspace.folders}
            navigate={navigate}
            open={openSheet}
            search={search}
            setSearch={setSearch}
            onUpdate={workspace.updateSaved}
            onDuplicate={(sheet) => {
              workspace.duplicateSaved(sheet);
              notify("Copy created.");
            }}
            onDelete={(id) => {
              workspace.deleteSaved(id);
              notify("Moved to Recently deleted.");
            }}
            onToggleStar={workspace.toggleStar}
            onRestore={(id) => {
              workspace.restoreSheet(id);
              notify("Sheet restored.");
            }}
            onPurge={(id) => {
              workspace.purgeSheet(id);
              chats.removeSheet(id);
              notify("Sheet deleted permanently.");
            }}
            onEmptyTrash={() => {
              workspace.deleted.forEach((sheet: Sheet) => chats.removeSheet(sheet.id));
              workspace.emptyTrash();
              notify("Bin emptied.");
            }}
          />
        ) : (
          <>
            <SheetHeader
              sheet={workspace.sheet}
              folders={workspace.folders}
              isSaved={workspace.isSaved}
              busy={generation.busy}
              editedCount={editedCount}
              panelOpen={panel.open}
              assistantStatus={assistantStatus}
              onTitle={(title) => workspace.commit({ ...workspace.sheet, title })}
              onFolder={(folder) => workspace.commit({ ...workspace.sheet, folder })}
              onSave={saveCopy}
              onDownload={download}
              onOpenPanel={() => panel.setOpen(true)}
            />
            <SheetToolbar
              undo={workspace.undo}
              redo={workspace.redo}
              canUndo={workspace.canUndo}
              canRedo={workspace.canRedo}
              bold={!!selectionFormat?.bold}
              align={selectionFormat?.align}
              format={workspace.format}
              filter={() => setDialog("filter")}
              sort={() => setDialog("sort")}
              busy={generation.busy}
              hasSheet={hasSheet}
            />
            <FormulaBar
              sheet={workspace.sheet}
              selection={workspace.selection}
              edit={workspace.edit}
              busy={generation.busy}
            />
            <CellDetail sheet={workspace.sheet} selection={workspace.selection} />
            <SpreadsheetGrid
              ref={grid}
              sheet={workspace.sheet}
              selection={workspace.selection}
              select={workspace.setSelection}
              edit={workspace.edit}
              busy={generation.busy}
            />
          </>
        )}
      </main>

      {panel.open && (
        <AssistantPanel
          panel={panel}
          generation={generation}
          sheet={workspace.sheet}
          hasSheet={hasSheet}
          draft={draft}
          setDraft={setDraft}
          error={error}
          chats={chats.chats}
          onOpenChat={openChat}
          onSubmit={() => void submit()}
          onImport={(document) => void generation.importDocument(document)}
        />
      )}

      {/* Progress and completion reach assistive technology here. */}
      <div className="sr-only" role="status" aria-live="polite">
        {generation.announcement}
      </div>

      {(toast || workspace.storage) && (
        <div
          className={`toast ${workspace.storage ? `tone-${workspace.storage.tone}` : ""}`}
          role="status"
        >
          <span>{toast?.text ?? workspace.storage?.message}</span>
          {toast?.undo && workspace.canUndo && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                workspace.undo();
                setToast(null);
                notify("Change undone.");
              }}
            >
              <Undo2 size={13} aria-hidden="true" />
              Undo
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss notification"
            onClick={() => {
              setToast(null);
              workspace.dismissStorage();
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      <SheetDialog
        kind={dialog}
        close={() => setDialog(null)}
        sheetColumns={workspace.sheet.columns}
        allFields={fields as Field[]}
        onCreateFolder={(name) => {
          if (workspace.folders.includes(name)) {
            notify("A folder with that name already exists.");
            return false;
          }
          workspace.setFolders([...workspace.folders, name]);
          notify("Folder created.");
          return true;
        }}
        onSort={(field, direction) => {
          const failure = generation.proposeEdit(`Sort by ${field} ${direction}`);
          if (failure) setError(failure);
          panel.setOpen(true);
        }}
        onFilter={(field, operator, value) => {
          const failure = generation.proposeEdit(
            `Only show products with ${field} ${operator} ${value}`,
          );
          if (failure) setError(failure);
          panel.setOpen(true);
        }}
      />
    </div>
  );
}
