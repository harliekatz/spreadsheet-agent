"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copySheet } from "@/lib/copySheet";
import { parseSaved, stringifySaved } from "@/lib/catalogStorage";
import { SEED_VERSION, sampleSheets } from "@/lib/samples";
import { folders as defaultFolders } from "@/lib/types";
import type { CellFormat, Field, Selection, Sheet } from "@/lib/types";

const STORAGE_KEY = "spreadsheet-agent:workspace:v1";
const HISTORY_LIMIT = 40;

export const emptySheet = (): Sheet => ({
  id: `sheet-${Date.now()}`,
  title: "Untitled sheet",
  folder: "",
  columns: [],
  rows: [],
  updatedAt: new Date().toISOString(),
  openedAt: new Date().toISOString(),
  formats: {},
});

export type StorageState = { message: string; tone: "warning" | "error" } | null;

export function useWorkspace() {
  const [sheet, setSheet] = useState<Sheet>(emptySheet);
  const [saved, setSaved] = useState<Sheet[]>(sampleSheets);
  const [folders, setFolders] = useState<string[]>(defaultFolders);
  const [view, setView] = useState("All Sheets");
  const [selection, setSelection] = useState<Selection>({ row: 0, col: 0 });
  const [hydrated, setHydrated] = useState(false);
  const [storage, setStorage] = useState<StorageState>(null);

  const history = useRef<Sheet[]>([]);
  const future = useRef<Sheet[]>([]);
  const [revision, setRevision] = useState(0);
  // Depths are mirrored into state so the undo and redo buttons re-render when
  // the stacks change. Reading a ref during render would not trigger that.
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });

  const syncDepth = useCallback(
    () => setDepth({ undo: history.current.length, redo: future.current.length }),
    [],
  );

  /* Restore ------------------------------------------------------- */
  // localStorage cannot be read while the static HTML is generated, so the
  // first client render must match the server output and hydrate afterwards.
  // That is what this effect is for; the lint rule cannot see the constraint.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = parseSaved<{
          sheets?: Sheet[];
          folders?: string[];
          seedVersion?: string;
        }>(raw);
        const valid =
          Array.isArray(parsed.sheets) &&
          parsed.sheets.every(
            (s) => s?.id && Array.isArray(s.columns) && Array.isArray(s.rows),
          );
        if (valid) {
          // Sheets the user made are always kept. The seeded demo sheets are
          // refreshed when the seed changes, so a stale copy in this browser
          // cannot outlive the code that produced it.
          const mine = parsed.sheets!.filter((s) => !s.id.startsWith("sample-"));
          const seeded =
            parsed.seedVersion === SEED_VERSION
              ? parsed.sheets!.filter((s) => s.id.startsWith("sample-"))
              : sampleSheets;
          setSaved([...mine, ...seeded]);
        }
        if (Array.isArray(parsed.folders) && parsed.folders.length)
          setFolders(parsed.folders);
      }
    } catch {
      setStorage({
        message:
          "Saved sheets on this device could not be read, so the demo library is shown instead. Nothing you do now is affected.",
        tone: "warning",
      });
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Persist ------------------------------------------------------- */
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        stringifySaved({ sheets: saved, folders, seedVersion: SEED_VERSION }),
      );
    } catch {
      // Quota failures can only be observed here, inside the write.
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setStorage({
        message:
          "This browser will not accept more saved data. Download a CSV to keep your work.",
        tone: "error",
      });
    }
  }, [saved, folders, hydrated]);

  /* The live sheet, mirrored into a ref so history can be recorded outside a
     state updater. Pushing to the stack from inside the updater ran during the
     render phase, which left canUndo one commit behind and risked a double
     push under StrictMode. */
  const sheetRef = useRef(sheet);
  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  const commit = useCallback(
    (next: Sheet, remember = true) => {
      if (remember) {
        history.current.push(structuredClone(sheetRef.current));
        if (history.current.length > HISTORY_LIMIT) history.current.shift();
        future.current = [];
      }
      const updated = { ...next, updatedAt: new Date().toISOString() };
      setSheet(updated);
      setSaved((prev) =>
        updated.columns.length
          ? [updated, ...prev.filter((s) => s.id !== updated.id)]
          : prev,
      );
      setRevision((r) => r + 1);
      syncDepth();
    },
    [syncDepth],
  );

  const resetHistory = useCallback(() => {
    history.current = [];
    future.current = [];
    setDepth({ undo: 0, redo: 0 });
  }, []);

  const open = useCallback(
    (next: Sheet) => {
      const opened = { ...structuredClone(next), openedAt: new Date().toISOString() };
      setSheet(opened);
      setSaved((prev) => prev.map((s) => (s.id === next.id ? opened : s)));
      setView("Open Sheet");
      setSelection({ row: 0, col: 0 });
      resetHistory();
      setRevision((r) => r + 1);
    },
    [resetHistory],
  );

  const newSheet = useCallback(() => {
    const next = emptySheet();
    setSheet(next);
    setView("New Sheet");
    setSelection({ row: 0, col: 0 });
    resetHistory();
    setRevision((r) => r + 1);
    return next;
  }, [resetHistory]);

  const saveCopy = useCallback(() => {
    const copy = copySheet(sheet);
    setSaved((prev) => [copy, ...prev]);
    return copy;
  }, [sheet]);

  const edit = useCallback(
    (rowIndex: number, colIndex: number, raw: string) => {
      const field = sheet.columns[colIndex];
      if (!field || !sheet.rows[rowIndex]) return;
      const previous = sheet.rows[rowIndex][field];
      const numeric = raw.replace(/[$,%\s]/g, "");
      const value =
        typeof previous === "number" && numeric !== "" && Number.isFinite(Number(numeric))
          ? Number(numeric)
          : raw;
      if (value === previous) return;
      commit({
        ...sheet,
        rows: sheet.rows.map((row, i) =>
          i === rowIndex ? { ...row, [field]: value } : row,
        ),
      });
    },
    [sheet, commit],
  );

  const format = useCallback(
    (patch: CellFormat) => {
      const key = `${selection.row}:${selection.col}`;
      commit({
        ...sheet,
        formats: { ...sheet.formats, [key]: { ...sheet.formats?.[key], ...patch } },
      });
    },
    [sheet, selection, commit],
  );

  const undo = useCallback(() => {
    const previous = history.current.pop();
    if (!previous) return;
    future.current.push(structuredClone(sheetRef.current));
    commit(previous, false);
  }, [commit]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(structuredClone(sheetRef.current));
    commit(next, false);
  }, [commit]);

  const updateSaved = useCallback(
    (id: string, patch: { title?: string; folder?: string }) => {
      const updatedAt = new Date().toISOString();
      setSaved((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt } : s)),
      );
      setSheet((current) =>
        current.id === id ? { ...current, ...patch, updatedAt } : current,
      );
    },
    [],
  );

  const duplicateSaved = useCallback((source: Sheet) => {
    setSaved((prev) => [copySheet(source), ...prev]);
  }, []);

  /** Soft delete. The sheet moves to Recently deleted rather than vanishing. */
  const deleteSaved = useCallback(
    (id: string) => {
      const deletedAt = new Date().toISOString();
      setSaved((prev) => prev.map((s) => (s.id === id ? { ...s, deletedAt } : s)));
      setSheet((current) => (current.id === id ? emptySheet() : current));
      if (sheet.id === id) {
        resetHistory();
        setSelection({ row: 0, col: 0 });
        setRevision((r) => r + 1);
      }
    },
    [sheet.id, resetHistory],
  );

  const restoreSheet = useCallback((id: string) => {
    setSaved((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const { deletedAt: _removed, ...restored } = s;
        return restored;
      }),
    );
  }, []);

  /** Permanent. Used only from Recently deleted, behind a confirmation. */
  const purgeSheet = useCallback((id: string) => {
    setSaved((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const emptyTrash = useCallback(() => {
    setSaved((prev) => prev.filter((s) => !s.deletedAt));
  }, []);

  const toggleStar = useCallback((id: string) => {
    setSaved((prev) => prev.map((s) => (s.id === id ? { ...s, starred: !s.starred } : s)));
    setSheet((current) =>
      current.id === id ? { ...current, starred: !current.starred } : current,
    );
  }, []);

  const isSaved = useMemo(
    () => saved.some((s) => s.id === sheet.id && !s.deletedAt),
    [saved, sheet.id],
  );

  /** Everything except the bin. The bin is only ever read by its own view. */
  const active = useMemo(() => saved.filter((s) => !s.deletedAt), [saved]);
  const deleted = useMemo(() => saved.filter((s) => s.deletedAt), [saved]);

  return {
    sheet,
    setSheet,
    commit,
    saved: active,
    deleted,
    saveCopy,
    open,
    newSheet,
    isSaved,
    view,
    setView,
    selection,
    setSelection,
    edit,
    format,
    undo,
    redo,
    canUndo: depth.undo > 0,
    canRedo: depth.redo > 0,
    folders,
    setFolders,
    updateSaved,
    duplicateSaved,
    deleteSaved,
    restoreSheet,
    purgeSheet,
    emptyTrash,
    toggleStar,
    storage,
    dismissStorage: () => setStorage(null),
    revision,
    hydrated,
  };
}

export type WorkspaceApi = ReturnType<typeof useWorkspace>;
export type { Field };
