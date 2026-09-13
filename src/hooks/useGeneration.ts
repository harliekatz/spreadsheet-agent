"use client";

import { useCallback, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { pause, reducedMotion } from "@/lib/animations";
import { countForPlan, interpret, runPlan } from "@/lib/query";
import type { ImportedDocument } from "@/lib/importDocument";
import type { QueryPlan, QueryResult, Sheet } from "@/lib/types";
import type { Chat, ChatMessage } from "./useChats";
import type { WorkspaceApi } from "./useWorkspace";

/**
 * The build sequence.
 *
 * A request never goes straight into the sheet. It is interpreted into a plan,
 * the plan is shown for review and editing, and only an approved plan runs.
 * Every stage label below names work that actually happens: there is no
 * database to connect to and no model in the loop.
 */

export type Phase = "idle" | "interpreting" | "review" | "building" | "ready";

/** A proposed change to a sheet that already exists, awaiting confirmation. */
export type PendingEdit = {
  result: QueryResult;
  request: string;
  rowDelta: number;
  columnDelta: number;
};

const ROW_BATCH = 25;

type Options = {
  workspace: WorkspaceApi;
  remember: (chat: Chat) => void;
  onBuildStart: () => void;
  onBuildComplete: () => void;
  /** Called after an assistant change lands, so the caller can offer an undo. */
  onChangeApplied: (summary: string) => void;
};

export function useGeneration({
  workspace,
  remember,
  onBuildStart,
  onBuildComplete,
  onChangeApplied,
}: Options) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [draftPlan, setDraftPlan] = useState<QueryPlan | null>(null);
  const [draftRows, setDraftRows] = useState(0);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activePlan, setActivePlan] = useState<QueryPlan | undefined>();
  const [stage, setStage] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  const [stageCount, setStageCount] = useState(1);
  const [announcement, setAnnouncement] = useState("");

  const initialChatId = useId();
  const chatId = useRef(initialChatId);
  const lock = useRef(false);

  const busy = phase === "interpreting" || phase === "building";

  const setChatId = useCallback((id?: string) => {
    chatId.current = id ?? `chat-${Date.now()}`;
  }, []);

  const reset = useCallback(
    (next: ChatMessage[] = []) => {
      setMessages(next);
      setDraftPlan(null);
      setPendingEdit(null);
      setActivePlan(undefined);
      setPhase("idle");
      setStage("");
      setStageIndex(0);
      setChatId();
    },
    [setChatId],
  );

  const runStages = async (labels: string[], between?: (index: number) => void) => {
    setStageCount(labels.length);
    for (let i = 0; i < labels.length; i += 1) {
      setStage(labels[i]);
      setStageIndex(i + 1);
      setAnnouncement(labels[i]);
      between?.(i);
      await pause(320);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Step 1: interpret the request into a reviewable plan                */
  /* ------------------------------------------------------------------ */

  const propose = useCallback(
    async (request: string, rowCriteria = ""): Promise<string | undefined> => {
      if (lock.current) return "The assistant is still working.";
      const result = interpret(request, { columns: "", rowCriteria });
      if (result.error) return result.error;

      lock.current = true;
      setPhase("interpreting");
      setMessages((current) => [...current, { role: "user", text: request }]);
      setAnnouncement("Interpreting request");
      setStage("Interpreting request");
      setStageIndex(1);
      setStageCount(1);
      onBuildStart();

      await pause(420);

      setDraftPlan(result.plan);
      setDraftRows(result.plan.matchedRows);
      setPhase("review");
      setAnnouncement(
        `Plan ready for review. ${result.plan.matchedRows.toLocaleString()} rows match, ${result.plan.columns.length} columns.`,
      );
      lock.current = false;
      return undefined;
    },
    [onBuildStart],
  );

  /** Apply an edit the user made in the plan review, and recount. */
  const editPlan = useCallback((patch: Partial<QueryPlan>) => {
    setDraftPlan((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      setDraftRows(countForPlan(next));
      return next;
    });
  }, []);

  const discardPlan = useCallback(() => {
    setDraftPlan(null);
    setPhase("idle");
    setMessages((current) => current.slice(0, -1));
    setStage("");
    setStageIndex(0);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Step 2: build the sheet from the approved plan                      */
  /* ------------------------------------------------------------------ */

  const build = useCallback(async (): Promise<string | undefined> => {
    if (!draftPlan || lock.current) return undefined;
    const result = runPlan(draftPlan);
    if (result.error) return result.error;

    lock.current = true;
    setPhase("building");
    setDraftPlan(null);
    onBuildStart();

    const base = workspace.newSheet();
    const columnCount = result.columns.length;
    const rowCount = result.rows.length;

    try {
      const filterLabel = result.plan.filters.length
        ? `Applying ${result.plan.filters.length} filter${result.plan.filters.length === 1 ? "" : "s"}`
        : "No filters to apply";

      await runStages(["Checking approved sources", filterLabel]);

      // Columns first, with no rows, so the shape of the sheet appears before
      // it fills.
      setStage(`Creating ${columnCount} column${columnCount === 1 ? "" : "s"}`);
      setStageIndex(3);
      setStageCount(5);
      setAnnouncement(`Creating ${columnCount} columns`);
      flushSync(() => {
        workspace.commit(
          {
            ...base,
            title: result.title,
            columns: result.columns,
            rows: [],
            datasetId: result.plan.datasetId,
            plan: result.plan,
          },
          false,
        );
        onBuildComplete();
      });
      await pause(360);

      // Rows in controlled batches, so the fill is visible rather than instant.
      setStage(`Adding ${rowCount.toLocaleString()} matching products`);
      setStageIndex(4);
      setAnnouncement(`Adding ${rowCount.toLocaleString()} matching products`);

      const batches = reducedMotion() ? 1 : Math.min(6, Math.ceil(rowCount / ROW_BATCH));
      const perBatch = Math.ceil(rowCount / Math.max(batches, 1));
      for (let index = 1; index <= batches; index += 1) {
        const upTo = Math.min(rowCount, index * perBatch);
        flushSync(() =>
          workspace.setSheet((current) => ({
            ...current,
            rows: result.rows.slice(0, upTo),
          })),
        );
        if (index < batches) await pause(180);
      }

      flushSync(() =>
        workspace.commit(
          {
            ...base,
            title: result.title,
            columns: result.columns,
            rows: result.rows,
            datasetId: result.plan.datasetId,
            plan: result.plan,
          },
          false,
        ),
      );

      setStage("Sheet ready");
      setStageIndex(5);
      setAnnouncement(
        `Sheet ready. ${rowCount.toLocaleString()} rows and ${columnCount} columns.`,
      );
      await pause(260);

      setActivePlan(result.plan);
      const completed: ChatMessage[] = [
        ...messages,
        {
          role: "assistant",
          text: `${result.title} is ready: ${rowCount.toLocaleString()} rows and ${columnCount} columns from the Northwind catalog.`,
        },
      ];
      setMessages(completed);
      setPhase("ready");
      remember({
        id: chatId.current,
        title: result.plan.request || result.title,
        messages: completed,
        sheet: {
          ...base,
          title: result.title,
          columns: result.columns,
          rows: result.rows,
          plan: result.plan,
          datasetId: result.plan.datasetId,
        } as Sheet,
        updatedAt: new Date().toISOString(),
      });
      return undefined;
    } catch (error) {
      console.error("Sheet build failed", error);
      setPhase("idle");
      return "That build could not finish. Your request is still in the box.";
    } finally {
      setStage("");
      setStageIndex(0);
      lock.current = false;
    }
  }, [draftPlan, workspace, messages, remember, onBuildStart, onBuildComplete]);

  /* ------------------------------------------------------------------ */
  /* Changes to a sheet that already exists                              */
  /* ------------------------------------------------------------------ */

  /** Interpret a change request and stage it for confirmation. */
  const proposeEdit = useCallback(
    (request: string): string | undefined => {
      if (lock.current) return "The assistant is still working.";
      const result = interpret(request, { sheet: workspace.sheet });
      if (result.error) return result.error;

      setMessages((current) => [...current, { role: "user", text: request }]);
      setPendingEdit({
        result,
        request,
        rowDelta: result.rows.length - workspace.sheet.rows.length,
        columnDelta: result.columns.length - workspace.sheet.columns.length,
      });
      setAnnouncement(
        `Change ready for review: ${result.rows.length.toLocaleString()} rows, ${result.columns.length} columns.`,
      );
      return undefined;
    },
    [workspace.sheet],
  );

  const applyEdit = useCallback(async () => {
    if (!pendingEdit || lock.current) return;
    const { result } = pendingEdit;
    lock.current = true;
    setPhase("building");
    setPendingEdit(null);

    try {
      await runStages([
        {
          add: "Adding the requested fields",
          remove: "Removing the column",
          sort: "Sorting the sheet",
          filter: "Applying filters",
          create: "Rebuilding the sheet",
        }[result.action],
      ]);

      flushSync(() =>
        workspace.commit({
          ...workspace.sheet,
          columns: result.columns,
          rows: result.rows,
          plan: result.plan,
        }),
      );

      setActivePlan(result.plan);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: `${result.summary}. Now ${result.rows.length.toLocaleString()} rows and ${result.columns.length} columns.`,
        },
      ]);
      onChangeApplied(result.summary);
      setAnnouncement(
        `Change applied. ${result.rows.length.toLocaleString()} rows and ${result.columns.length} columns.`,
      );
      setPhase("ready");
    } finally {
      setStage("");
      setStageIndex(0);
      lock.current = false;
    }
  }, [pendingEdit, workspace, onChangeApplied]);

  const discardEdit = useCallback(() => {
    setPendingEdit(null);
    setMessages((current) => current.slice(0, -1));
  }, []);

  /* ------------------------------------------------------------------ */
  /* Document import                                                     */
  /* ------------------------------------------------------------------ */

  const importDocument = useCallback(
    async (document: ImportedDocument) => {
      if (lock.current) return;
      lock.current = true;
      setPhase("building");
      onBuildStart();

      const base = workspace.newSheet();
      const title = document.name.replace(/\.[^.]+$/, "");
      const history: ChatMessage[] = [
        { role: "user", text: `Build a sheet from ${document.name}` },
      ];
      setMessages(history);
      setChatId();

      try {
        await runStages([
          `Reading ${document.name} in your browser`,
          `Mapping ${document.columns.length} columns`,
          `Adding ${document.rows.length.toLocaleString()} rows`,
        ]);

        const sheet: Sheet = {
          ...base,
          title,
          columns: document.columns,
          rows: document.rows,
          sourceFile: document.name,
          datasetId: `imported:${document.name}`,
        };

        flushSync(() => {
          workspace.commit(sheet, false);
          onBuildComplete();
        });

        const completed: ChatMessage[] = [
          ...history,
          {
            role: "assistant",
            text: `Built ${document.rows.length.toLocaleString()} rows and ${document.columns.length} columns from ${document.name} using ${document.method.toLowerCase()}. Check the values before you rely on them.`,
          },
        ];
        setMessages(completed);
        setPhase("ready");
        setAnnouncement(`Sheet ready from ${document.name}.`);
        remember({
          id: chatId.current,
          title: `Import ${document.name}`,
          messages: completed,
          sheet,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Document import failed", error);
        setPhase("idle");
        setMessages([
          ...history,
          {
            role: "assistant",
            text: "That document could not be turned into a sheet. Your saved sheets are untouched.",
          },
        ]);
      } finally {
        setStage("");
        setStageIndex(0);
        lock.current = false;
      }
    },
    [workspace, remember, onBuildStart, onBuildComplete, setChatId],
  );

  return {
    phase,
    busy,
    draftPlan,
    draftRows,
    pendingEdit,
    activePlan,
    setActivePlan,
    messages,
    setMessages,
    stage,
    stageIndex,
    stageCount,
    announcement,
    propose,
    editPlan,
    discardPlan,
    build,
    proposeEdit,
    applyEdit,
    discardEdit,
    importDocument,
    reset,
    setChatId,
  };
}

export type GenerationApi = ReturnType<typeof useGeneration>;
