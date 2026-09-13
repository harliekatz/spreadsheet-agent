"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  FolderInput,
  Download,
  Trash2,
  X,
} from "lucide-react";
import type { Sheet } from "@/lib/types";
import { downloadCsv } from "@/lib/csv";
export type FileActionProps = {
  sheet: Sheet;
  folders: string[];
  onUpdate: (id: string, patch: { title?: string; folder?: string }) => void;
  onDuplicate: (sheet: Sheet) => void;
  onDelete: (id: string) => void;
};
export function FileActions({
  sheet,
  folders,
  onUpdate,
  onDuplicate,
  onDelete,
}: FileActionProps) {
  const menu = useRef<HTMLDetailsElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState<"rename" | "move" | "delete" | null>(null);
  const [value, setValue] = useState("");
  const closeMenu = () => {
    if (menu.current) menu.current.open = false;
  };
  const restoreFocus = () => menu.current?.querySelector("summary")?.focus();
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    if (action) dialog.current?.showModal();
  }, [action]);
  const begin = (next: "rename" | "move" | "delete") => {
    closeMenu();
    setValue(next === "rename" ? sheet.title : sheet.folder);
    setAction(next);
  };
  const close = () => {
    dialog.current?.close();
    setAction(null);
    restoreFocus();
  };
  const confirm = () => {
    if (action === "rename" && !value.trim()) return;
    if (action === "rename") onUpdate(sheet.id, { title: value.trim() });
    if (action === "move") onUpdate(sheet.id, { folder: value });
    close();
    if (action === "delete") onDelete(sheet.id);
  };
  return (
    <>
      <details
        className="file-actions"
        ref={menu}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            closeMenu();
            restoreFocus();
          }
        }}
      >
        <summary aria-label={`More actions for ${sheet.title}`} title="File actions">
          <MoreHorizontal size={20} />
        </summary>
        <div className="file-actions-popover" aria-label={`Actions for ${sheet.title}`}>
          <button onClick={() => begin("rename")}>
            <Pencil size={16} />
            Rename
          </button>
          <button
            onClick={() => {
              closeMenu();
              onDuplicate(sheet);
              restoreFocus();
            }}
          >
            <Copy size={16} />
            Make a copy
          </button>
          <button onClick={() => begin("move")}>
            <FolderInput size={16} />
            Move to folder
          </button>
          <button
            onClick={() => {
              closeMenu();
              downloadCsv(sheet);
              restoreFocus();
            }}
          >
            <Download size={16} />
            Download CSV
          </button>
          <button className="file-delete-action" onClick={() => begin("delete")}>
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </details>
      {action &&
        createPortal(
          <dialog
            className="file-action-dialog"
            ref={dialog}
            aria-labelledby={`file-action-title-${sheet.id}`}
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                confirm();
              }}
            >
              <div className="file-action-heading">
                <h2 id={`file-action-title-${sheet.id}`}>
                  {action === "rename"
                    ? "Rename sheet"
                    : action === "move"
                      ? "Move to folder"
                      : "Delete sheet?"}
                </h2>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Close dialog"
                  onClick={close}
                >
                  <X size={20} />
                </button>
              </div>
              {action === "rename" ? (
                <label>
                  Sheet name
                  <input
                    autoFocus
                    required
                    maxLength={120}
                    value={value}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => setValue(event.target.value)}
                  />
                </label>
              ) : action === "move" ? (
                <label>
                  Folder
                  <select
                    autoFocus
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  >
                    <option value="">No folder</option>
                    {folders.map((folder) => (
                      <option key={folder} value={folder}>
                        {folder}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p>
                  &ldquo;{sheet.title}&rdquo; and its saved conversation will be removed
                  from this browser. This cannot be undone.
                </p>
              )}
              <div className="file-action-buttons">
                <button
                  type="button"
                  className="button"
                  autoFocus={action === "delete"}
                  onClick={close}
                >
                  Cancel
                </button>
                <button
                  className={`button ${action === "delete" ? "file-confirm-delete" : "primary"}`}
                  disabled={action === "rename" && !value.trim()}
                >
                  {action === "rename"
                    ? "Save name"
                    : action === "move"
                      ? "Move sheet"
                      : "Delete sheet"}
                </button>
              </div>
            </form>
          </dialog>,
          document.body,
        )}
    </>
  );
}
