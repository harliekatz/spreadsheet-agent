"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, MessageSquare, PanelRightClose, ShieldCheck } from "lucide-react";
import { dataset } from "@/lib/data";
import type { AssistantPanelApi } from "@/hooks/useAssistantPanel";
import type { GenerationApi } from "@/hooks/useGeneration";
import type { Chat } from "@/hooks/useChats";
import type { ImportedDocument } from "@/lib/importDocument";
import type { Sheet } from "@/lib/types";
import { ImportDocument } from "./ImportDocument";
import { PlanReview } from "./PlanReview";
import { AppliedPlan } from "./AppliedPlan";
import { ChangePreview } from "./ChangePreview";
import { BuildProgress } from "./BuildProgress";

export function AssistantPanel({
  panel,
  generation,
  sheet,
  hasSheet,
  draft,
  setDraft,
  error,
  chats,
  onOpenChat,
  onSubmit,
  onImport,
}: {
  panel: AssistantPanelApi;
  generation: GenerationApi;
  sheet: Sheet;
  hasSheet: boolean;
  draft: string;
  setDraft: (value: string) => void;
  error: string;
  chats: Chat[];
  onOpenChat: (chat: Chat) => void;
  onSubmit: () => void;
  onImport: (document: ImportedDocument) => void;
}) {
  const { phase, busy, draftPlan, pendingEdit, activePlan, messages } = generation;
  const feed = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" });
  }, [messages, phase, draftPlan, pendingEdit]);

  const showStart = !hasSheet && phase === "idle" && !draftPlan;
  const canSend = !!draft.trim() && !busy;

  const composer = (
    <form
      className={`composer ${showStart ? "composer-large" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <label className="sr-only" htmlFor="agent-prompt">
        {hasSheet ? "Ask for a change to this sheet" : "Describe the result you need"}
      </label>
      <textarea
        id="agent-prompt"
        ref={promptRef}
        rows={showStart ? 3 : 2}
        value={draft}
        disabled={busy}
        placeholder={
          hasSheet ? "Ask for a change to this sheet…" : "Describe the result you need…"
        }
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSubmit();
          }
        }}
      />
      <div className="composer-foot">
        <ImportDocument busy={busy} onBuild={async (document) => onImport(document)} />
        <button
          type="submit"
          className="send-button tip"
          data-tip="Send request"
          aria-label="Send request"
          disabled={!canSend}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p className="composer-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );

  return (
    <aside
      className={`assistant-panel ${panel.resizing ? "is-resizing" : ""}`}
      aria-label="Assistant"
    >
      <div className="panel-resize" {...panel.resizeHandle}>
        <span className="panel-resize-grip" aria-hidden="true" />
      </div>

      <header className="panel-head">
        <h2>Assistant</h2>
        <button
          type="button"
          className="icon-button tip tip-left"
          data-tip="Minimize panel"
          aria-label="Minimize the assistant panel"
          onClick={() => panel.setOpen(false)}
        >
          <PanelRightClose size={17} aria-hidden="true" />
        </button>
      </header>

      <div className="panel-body" ref={feed}>
        {showStart ? (
          <div className="panel-start">
            <h3 className="start-title">Build a sheet from company data</h3>
            <p className="start-copy">
              Describe the result you need. Review the data source and logic before anything
              is added to your sheet.
            </p>

            {composer}

            {chats.length > 0 && (
              <div className="recent-chats">
                <p className="eyebrow">Recent</p>
                <ul>
                  {chats.slice(0, 5).map((chat) => (
                    <li key={chat.id}>
                      <button type="button" onClick={() => onOpenChat(chat)}>
                        <MessageSquare size={13} aria-hidden="true" />
                        <span className="recent-title">{chat.title}</span>
                        <span className="recent-date tabular">
                          {new Date(chat.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="conversation" role="log" aria-label="Conversation">
              {messages.map((message, index) => (
                <div key={index} className={`message message-${message.role}`}>
                  <span className="eyebrow">
                    {message.role === "user" ? "You" : "Assistant"}
                  </span>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>

            {(phase === "interpreting" || phase === "building") && (
              <BuildProgress
                stage={generation.stage}
                stageIndex={generation.stageIndex}
                stageCount={generation.stageCount}
              />
            )}

            {draftPlan && phase === "review" && (
              <PlanReview
                plan={draftPlan}
                matchedRows={generation.draftRows}
                busy={busy}
                onChange={generation.editPlan}
                onBuild={() => void generation.build()}
                onDiscard={generation.discardPlan}
              />
            )}

            {pendingEdit && (
              <ChangePreview
                edit={pendingEdit}
                busy={busy}
                onApply={() => void generation.applyEdit()}
                onDiscard={generation.discardEdit}
              />
            )}

            {activePlan && phase === "ready" && !pendingEdit && (
              <AppliedPlan plan={activePlan} />
            )}
          </>
        )}
      </div>

      {!showStart && <div className="panel-composer">{composer}</div>}

      <footer className="panel-foot">
        <ShieldCheck size={14} aria-hidden="true" />
        <span>
          {sheet.sourceFile
            ? `Imported from ${sheet.sourceFile}`
            : `${dataset.name} · ${dataset.recordCount.toLocaleString()} synthetic records`}
        </span>
      </footer>
    </aside>
  );
}
