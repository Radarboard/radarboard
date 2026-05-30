"use client";

import type { LlmChatStatus, LlmMessage } from "@radarboard/llm/types";
import { chatConversationExtractRoute } from "@radarboard/types/api-routes";
import type { AssistantHandoffItem } from "@radarboard/types/assistant";
import type { AssistantMode } from "@radarboard/types/database";
import type { RichTextComposerHandle } from "@radarboard/ui/rich-text-composer";
import { useStore } from "@tanstack/react-store";
import type React from "react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from "react";
import {
  type ChatThread,
  chatActions,
  chatStore,
  createThread,
  deleteThread,
  ensureThread,
  loadMessages,
  loadThreads,
  refreshThreadList,
  renameThread,
} from "./chat-store";
import { useChatSession } from "./use-chat-session";

async function extractConversationMemories(conversationId: string): Promise<void> {
  await fetch(chatConversationExtractRoute(conversationId), { method: "POST" });
}

// ---------------------------------------------------------------------------
// Public interface — same shape as before so all consumers are unchanged
// ---------------------------------------------------------------------------

interface ChatContextValue {
  threads: ChatThread[];
  activeThreadId: string | null;
  selectedModel: string | null;
  selectedMode: AssistantMode;
  challengerModel: string | null;
  loadedMessages: LlmMessage[];
  pinnedProject: string | null;
  setPinnedProject: (slug: string | null) => void;
  selectThread: (id: string) => void;
  createThread: () => Promise<void>;
  renameThread: (id: string, title: string) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  ensureThread: () => Promise<string>;
  setSelectedModel: (model: string | null) => void;
  setSelectedMode: (mode: AssistantMode) => void;
  setChallengerModel: (model: string | null) => void;
  registerComposerRef: (el: RichTextComposerHandle | null) => void;
  focusComposer: () => void;
  registerEditLastMessage: (fn: (() => void) | null) => void;
  editLastUserMessage: () => void;
  branchAfterMessageId: string | null;
  setBranchAfterMessageId: (id: string | null) => void;
  session: {
    messages: LlmMessage[];
    sendMessage: (
      text: string,
      images?: { dataUrl: string; mimeType: string }[],
      options?: {
        artifactIds?: string[];
        noteIds?: string[];
        skillIds?: string[];
        runtimeItems?: AssistantHandoffItem[];
      }
    ) => void;
    stop: () => void;
    regenerate: () => void;
    resumeStream: () => void;
    clearMessages: () => void;
    truncateMessagesAfter: (messageId: string) => string | null;
    clearError: () => void;
    status: LlmChatStatus;
    error: Error | null;
    lastUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
    totalUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  };
}

// ---------------------------------------------------------------------------
// Session context — holds only DOM refs + live useChat session
// (cannot go in the store since useChat is a React hook)
// ---------------------------------------------------------------------------

interface SessionContextValue {
  composerRef: React.RefObject<RichTextComposerHandle | null>;
  editLastMessageRef: React.RefObject<(() => void) | null>;
  session: ChatContextValue["session"];
}

const SessionContext = createContext<SessionContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ChatProvider({ children }: { children: ReactNode }) {
  const composerRef = useRef<RichTextComposerHandle | null>(null);
  const editLastMessageRef = useRef<(() => void) | null>(null);
  const prevSessionStatusRef = useRef<string>("ready");

  // Read from store for the session hook
  const activeThreadId = useStore(chatStore, (s) => s.activeThreadId);
  const selectedModel = useStore(chatStore, (s) => s.selectedModel);
  const selectedMode = useStore(chatStore, (s) => s.selectedMode);
  const challengerModel = useStore(chatStore, (s) => s.challengerModel);
  const loadedMessages = useStore(chatStore, (s) => s.loadedMessages);
  const pinnedProject = useStore(chatStore, (s) => s.pinnedProject);

  const session = useChatSession(
    selectedModel,
    loadedMessages,
    pinnedProject,
    selectedMode,
    challengerModel
  );

  // Load threads on mount (eager thread creation included in loadThreads)
  useEffect(() => {
    loadThreads().catch(() => {
      // Non-critical — start empty
    });
  }, []);

  // Load messages when active thread changes
  useEffect(() => {
    if (!activeThreadId) {
      chatActions.setLoadedMessages([]);
      return;
    }
    loadMessages(activeThreadId).catch(() => {
      chatActions.setLoadedMessages([]);
    });
  }, [activeThreadId]);

  // Refresh thread list + extract memories after each stream
  useEffect(() => {
    const prev = prevSessionStatusRef.current;
    prevSessionStatusRef.current = session.status;
    if (!activeThreadId) return;
    if ((prev === "streaming" || prev === "submitted") && session.status === "ready") {
      refreshThreadList().catch(() => {
        // Non-critical — title refresh is best-effort
      });
      // Fire-and-forget: extract conversation memories in the background.
      // Non-fatal — will no-op if the conversation is too short.
      extractConversationMemories(activeThreadId).catch(() => {
        // fire-and-forget, ignore errors
      });
    }
  }, [session.status, activeThreadId]);

  return (
    <SessionContext value={{ composerRef, editLastMessageRef, session }}>{children}</SessionContext>
  );
}

// ---------------------------------------------------------------------------
// useChatContext — public hook, same API as before
// ---------------------------------------------------------------------------

export function useChatContext(): ChatContextValue {
  const sessionCtx = useContext(SessionContext);
  if (!sessionCtx) throw new Error("useChatContext must be used within <ChatProvider>");

  // Subscribe to store slices (each selector ensures granular re-renders)
  const threads = useStore(chatStore, (s) => s.threads);
  const activeThreadId = useStore(chatStore, (s) => s.activeThreadId);
  const selectedModel = useStore(chatStore, (s) => s.selectedModel);
  const selectedMode = useStore(chatStore, (s) => s.selectedMode);
  const challengerModel = useStore(chatStore, (s) => s.challengerModel);
  const loadedMessages = useStore(chatStore, (s) => s.loadedMessages);
  const pinnedProject = useStore(chatStore, (s) => s.pinnedProject);
  const branchAfterMessageId = useStore(chatStore, (s) => s.branchAfterMessageId);

  const { composerRef, editLastMessageRef, session } = sessionCtx;

  const registerComposerRef = useCallback(
    (el: RichTextComposerHandle | null) => {
      composerRef.current = el;
    },
    [composerRef]
  );

  const focusComposer = useCallback(() => {
    composerRef.current?.focus();
  }, [composerRef]);

  const registerEditLastMessage = useCallback(
    (fn: (() => void) | null) => {
      editLastMessageRef.current = fn;
    },
    [editLastMessageRef]
  );

  const editLastUserMessage = useCallback(() => {
    editLastMessageRef.current?.();
  }, [editLastMessageRef]);

  return {
    threads,
    activeThreadId,
    selectedModel,
    selectedMode,
    challengerModel,
    loadedMessages,
    pinnedProject,
    branchAfterMessageId,
    session,
    // Actions — stable references since they don't close over React state
    setPinnedProject: chatActions.setPinnedProject,
    setSelectedModel: chatActions.setSelectedModel,
    setSelectedMode: chatActions.setSelectedMode,
    setChallengerModel: chatActions.setChallengerModel,
    selectThread: chatActions.selectThread,
    setBranchAfterMessageId: chatActions.setBranchAfterMessageId,
    createThread,
    renameThread,
    deleteThread,
    ensureThread,
    registerComposerRef,
    focusComposer,
    registerEditLastMessage,
    editLastUserMessage,
  };
}

// Re-export store primitives for consumers that want direct slice subscriptions
export { type ChatThread, chatActions, chatStore };
