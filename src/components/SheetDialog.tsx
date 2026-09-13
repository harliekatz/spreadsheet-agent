"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Field } from "@/lib/types";

export type DialogKind = "folder" | "filter" | "sort" | null;

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

const TITLES: Record<Exclude<DialogKind, null>, string> = {
  folder: "New folder",
  filter: "Filter rows",
  sort: "Sort sheet",
};

/**
 * One modal for the three small sheet actions. Focus is trapped while it is
 * open and returned to whatever opened it on close.
 */
export function SheetDialog({
  kind,
  close,
  sheetColumns,
  allFields,
  onCreateFolder,
  onSort,
  onFilter,
}: {
  kind: DialogKind;
  close: () => void;
  sheetColumns: Field[];
  allFields: Field[];
  onCreateFolder: (name: string) => boolean;
  onSort: (field: Field, direction: string) => void;
  onFilter: (field: Field, operator: string, value: string) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const [folderName, setFolderName] = useState("");
  const [field, setField] = useState<Field>("");
  const [operator, setOperator] = useState("below");
  const [value, setValue] = useState("100");
  const [direction, setDirection] = useState("highest to lowest");

  useEffect(() => {
    if (!kind) return;
    opener.current = document.activeElement as HTMLElement;
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const previous = opener.current;
    return () => previous?.focus?.();
  }, [kind]);

  if (!kind) return null;

  const columnOptions = kind === "sort" ? sheetColumns : allFields;
  // Fall back rather than storing a default in state, so the value is always
  // valid for whichever list is currently on screen.
  const activeField = columnOptions.includes(field)
    ? field
    : columnOptions.includes("Inventory")
      ? "Inventory"
      : (columnOptions[0] ?? "");

  const submit = () => {
    if (kind === "folder") {
      const name = folderName.trim();
      if (!name) return;
      if (!onCreateFolder(name)) return;
      setFolderName("");
      close();
      return;
    }
    if (kind === "sort") onSort(activeField, direction);
    else onFilter(activeField, operator, value);
    close();
  };

  const trapFocus = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const nodes = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-dialog-title"
        ref={panel}
        onKeyDown={trapFocus}
      >
        <div className="dialog-heading">
          <h2 id="sheet-dialog-title">{TITLES[kind]}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {kind === "folder" ? (
            <label>
              Folder name
              <input
                autoFocus
                required
                maxLength={60}
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
              />
            </label>
          ) : (
            <>
              <label>
                Column
                <select
                  value={activeField}
                  onChange={(event) => setField(event.target.value)}
                >
                  {columnOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>

              {kind === "sort" ? (
                <label>
                  Order
                  <select
                    value={direction}
                    onChange={(event) => setDirection(event.target.value)}
                  >
                    <option>highest to lowest</option>
                    <option>lowest to highest</option>
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    Condition
                    <select
                      value={operator}
                      onChange={(event) => setOperator(event.target.value)}
                    >
                      <option value="below">is less than</option>
                      <option value="above">is greater than</option>
                      <option value="contains">contains</option>
                    </select>
                  </label>
                  <label>
                    Value
                    <input
                      required
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                    />
                  </label>
                </>
              )}
              <p className="dialog-note">
                This runs through the same interpreter as a typed request, so the query plan
                and source references stay accurate.
              </p>
            </>
          )}

          <div className="dialog-buttons">
            <button type="button" className="button secondary" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="button primary">
              {kind === "folder" ? "Create folder" : "Apply"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
