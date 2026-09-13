"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "spreadsheet-agent:panel:v1";
const MIN_WIDTH = 320;
const MAX_WIDTH = 680;
const DEFAULT_WIDTH = 400;
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

const clamp = (value: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));

type Stored = { width: number; open: boolean };

/**
 * The assistant is a fixed panel in the app's grid, not a floating window.
 *
 * It owns only two things: whether it is open, and how wide it is. Because the
 * width is a grid track on the shell rather than a position, opening, closing
 * and dragging all reflow the spreadsheet instead of covering it.
 */
export function useAssistantPanel() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [open, setOpen] = useState(true);
  const [resizing, setResizing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  // Preferences cannot be read while the static HTML is generated.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<Stored>;
        if (typeof stored.width === "number") setWidth(clamp(stored.width));
        if (typeof stored.open === "boolean") setOpen(stored.open);
      }
    } catch {
      // A missing preference is not worth telling the user about.
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ width, open } satisfies Stored));
    } catch {
      // Losing the remembered width is not worth interrupting anyone for.
    }
  }, [width, open, hydrated]);

  /* Pointer resize. Listeners live on the window so the drag survives the
     pointer leaving the 6px handle. */
  useEffect(() => {
    if (!resizing) return;

    const move = (event: PointerEvent) => {
      if (!drag.current) return;
      // The panel is on the right, so dragging left widens it.
      setWidth(clamp(drag.current.startWidth + (drag.current.startX - event.clientX)));
    };
    const stop = () => {
      drag.current = null;
      setResizing(false);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [resizing]);

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      drag.current = { startX: event.clientX, startWidth: width };
      setResizing(true);
    },
    [width],
  );

  const keyResize = useCallback((event: React.KeyboardEvent) => {
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setWidth((current) => clamp(current + step));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setWidth((current) => clamp(current - step));
    } else if (event.key === "Home") {
      event.preventDefault();
      setWidth(DEFAULT_WIDTH);
    }
  }, []);

  return {
    open,
    setOpen,
    toggle: useCallback(() => setOpen((value) => !value), []),
    width,
    resizing,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    /** Props for the drag handle between the sheet and the panel. */
    resizeHandle: {
      role: "separator" as const,
      "aria-orientation": "vertical" as const,
      "aria-label": "Resize the assistant panel",
      "aria-valuenow": width,
      "aria-valuemin": MIN_WIDTH,
      "aria-valuemax": MAX_WIDTH,
      tabIndex: 0,
      onPointerDown: startResize,
      onKeyDown: keyResize,
      onDoubleClick: () => setWidth(DEFAULT_WIDTH),
    },
  };
}

export type AssistantPanelApi = ReturnType<typeof useAssistantPanel>;
