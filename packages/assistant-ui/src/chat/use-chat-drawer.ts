"use client";

import { parseAsString, useQueryState } from "nuqs";
import { useCallback } from "react";

const CHAT_OPEN_VALUE = "open";

/**
 * Manages chat drawer open/close state via the URL (?chat=open).
 * This lets the drawer state survive page refreshes and be shareable.
 */
export function useChatDrawer() {
  const [chatParam, setChatParam] = useQueryState("chat", parseAsString);

  const isOpen = chatParam === CHAT_OPEN_VALUE;

  const open = useCallback(() => {
    setChatParam(CHAT_OPEN_VALUE);
  }, [setChatParam]);

  const close = useCallback(() => {
    setChatParam(null);
  }, [setChatParam]);

  const toggle = useCallback(() => {
    setChatParam(isOpen ? null : CHAT_OPEN_VALUE);
  }, [isOpen, setChatParam]);

  return { isOpen, open, close, toggle };
}
