"use client";

import { useStore } from "@tanstack/react-store";
import { chatActions, chatStore } from "./chat-store";

/**
 * Manages the foldable state of the chat thread sidebar.
 * Backed by chatStore — state is shared across all consumers without prop drilling.
 */
export function useChatSidebar() {
  const isSidebarOpen = useStore(chatStore, (s) => s.isSidebarOpen);
  return { isSidebarOpen, toggleSidebar: chatActions.toggleSidebar };
}
