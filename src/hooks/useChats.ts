"use client";

import { useEffect, useState } from "react";
import { parseSaved, stringifySaved } from "@/lib/catalogStorage";
import { sampleChats } from "@/lib/sampleChats";
import type { Sheet } from "@/lib/types";

const STORAGE_KEY = "spreadsheet-agent:chats:v1";
const LIMIT = 12;

export type ChatMessage = { role: "user" | "assistant"; text: string };

export type Chat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  sheet: Sheet;
  updatedAt: string;
};

export function useChats() {
  const [chats, setChats] = useState<Chat[]>(sampleChats);
  const [hydrated, setHydrated] = useState(false);
  const [failed, setFailed] = useState(false);

  // Browser storage is unreadable while the static HTML is generated, so the
  // first client render must match the server output and hydrate after it.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = parseSaved<Chat[]>(raw);
        if (Array.isArray(parsed))
          setChats(
            parsed
              .filter((c) => c?.id && c.sheet?.columns && Array.isArray(c.messages))
              .slice(0, LIMIT),
          );
      }
    } catch {
      // Keep the seeded chats and tell the caller, rather than silently
      // discarding the user's history with no explanation.
      setFailed(true);
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, stringifySaved(chats));
    } catch {
      // Quota failures can only be observed here, inside the write.
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setFailed(true);
    }
  }, [chats, hydrated]);

  return {
    chats,
    historyUnavailable: failed,
    removeSheet: (id: string) =>
      setChats((prev) => prev.filter((chat) => chat.sheet.id !== id)),
    remember: (chat: Chat) =>
      setChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)].slice(0, LIMIT)),
  };
}
