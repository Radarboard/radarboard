"use client";

import type { LlmMessage } from "@radarboard/llm/types";
import { API_ROUTES, chatConversationRoute } from "@radarboard/types/api-routes";
import type { AssistantHandoffItem } from "@radarboard/types/assistant";
import type { AssistantMode, LlmConversationRow } from "@radarboard/types/database";
import { Store } from "@tanstack/react-store";

export type ChatThread = Pick<LlmConversationRow, "id" | "title" | "projectSlug">;

export interface ChatState {
  threads: ChatThread[];
  activeThreadId: string | null;
  selectedModel: string | null;
  selectedMode: AssistantMode;
  challengerModel: string | null;
  loadedMessages: LlmMessage[];
  pinnedProject: string | null;
  branchAfterMessageId: string | null;
  isSidebarOpen: boolean;
  chatWidth: number;
  pendingAssistantHandoff: {
    nonce: number;
    items: AssistantHandoffItem[];
    promptText: string | null;
  } | null;
}

const MODEL_STORAGE_KEY = "radarboard:chat-model";
const MODE_STORAGE_KEY = "radarboard:chat-mode";
const CHALLENGER_STORAGE_KEY = "radarboard:chat-challenger";
const SIDEBAR_STORAGE_KEY = "radarboard:chat-sidebar";
const WIDTH_STORAGE_KEY = "radarboard:chat-width";
const THREAD_STORAGE_KEY = "radarboard:chat-thread";

const MIN_CHAT_WIDTH = 280;
const MAX_CHAT_WIDTH = 800;
const DEFAULT_CHAT_WIDTH = 420;

function clampWidth(value: number): number {
  return Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, value));
}

function readInitialModel(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(MODEL_STORAGE_KEY);
}

function readInitialMode(): AssistantMode {
  if (typeof window === "undefined") return "default";
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  switch (stored) {
    case "explore":
    case "plan":
    case "review":
    case "qa":
      return stored;
    default:
      return "default";
  }
}

function readInitialChallengerModel(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CHALLENGER_STORAGE_KEY);
}

function readInitialSidebarOpen(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "open";
}

function readInitialChatWidth(): number {
  if (typeof window === "undefined") return DEFAULT_CHAT_WIDTH;
  const stored = localStorage.getItem(WIDTH_STORAGE_KEY);
  return stored ? clampWidth(Number(stored)) : DEFAULT_CHAT_WIDTH;
}

function readInitialActiveThread(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(THREAD_STORAGE_KEY);
}

export const chatStore = new Store<ChatState>({
  threads: [],
  activeThreadId: readInitialActiveThread(),
  selectedModel: readInitialModel(),
  selectedMode: readInitialMode(),
  challengerModel: readInitialChallengerModel(),
  loadedMessages: [],
  pinnedProject: null,
  branchAfterMessageId: null,
  isSidebarOpen: readInitialSidebarOpen(),
  chatWidth: readInitialChatWidth(),
  pendingAssistantHandoff: null,
});

function dedupeAssistantHandoffItems(items: AssistantHandoffItem[]): AssistantHandoffItem[] {
  return [...new Map(items.map((item) => [`${item.kind}:${item.id}`, item] as const)).values()];
}

// ---------------------------------------------------------------------------
// Synchronous state mutations
// ---------------------------------------------------------------------------

export const chatActions = {
  setThreads: (threads: ChatThread[]) => chatStore.setState((s: ChatState) => ({ ...s, threads })),

  setActiveThreadId: (id: string | null) => {
    if (id) localStorage.setItem(THREAD_STORAGE_KEY, id);
    else localStorage.removeItem(THREAD_STORAGE_KEY);
    chatStore.setState((s: ChatState) => ({ ...s, activeThreadId: id }));
  },

  setLoadedMessages: (msgs: LlmMessage[]) =>
    chatStore.setState((s: ChatState) => ({ ...s, loadedMessages: msgs })),

  setSelectedMode: (mode: AssistantMode) => {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
    chatStore.setState((s: ChatState) => ({ ...s, selectedMode: mode }));
  },

  setChallengerModel: (model: string | null) => {
    if (model) localStorage.setItem(CHALLENGER_STORAGE_KEY, model);
    else localStorage.removeItem(CHALLENGER_STORAGE_KEY);
    chatStore.setState((s: ChatState) => ({ ...s, challengerModel: model }));
  },

  setPinnedProject: (slug: string | null) =>
    chatStore.setState((s: ChatState) => ({ ...s, pinnedProject: slug })),

  setBranchAfterMessageId: (id: string | null) =>
    chatStore.setState((s: ChatState) => ({ ...s, branchAfterMessageId: id })),

  setSelectedModel: (model: string | null) => {
    if (model) localStorage.setItem(MODEL_STORAGE_KEY, model);
    else localStorage.removeItem(MODEL_STORAGE_KEY);
    chatStore.setState((s: ChatState) => ({ ...s, selectedModel: model }));
  },

  // Clear loadedMessages atomically with the thread ID change so that
  // useChatSession.seedMessages is undefined on the first render after a switch.
  // This prevents the stale-messages display bug where Thread A's history was
  // shown when viewing Thread B.
  selectThread: (id: string) => {
    localStorage.setItem(THREAD_STORAGE_KEY, id);
    chatStore.setState((s: ChatState) => ({
      ...s,
      activeThreadId: id,
      pinnedProject: null,
      loadedMessages: [],
    }));
  },

  addThread: (thread: ChatThread) => {
    localStorage.setItem(THREAD_STORAGE_KEY, thread.id);
    chatStore.setState((s: ChatState) => ({
      ...s,
      threads: [thread, ...s.threads],
      activeThreadId: thread.id,
      loadedMessages: [],
    }));
  },

  removeThread: (id: string) => {
    const isActive = chatStore.state.activeThreadId === id;
    if (isActive) localStorage.removeItem(THREAD_STORAGE_KEY);
    chatStore.setState((s: ChatState) => ({
      ...s,
      threads: s.threads.filter((t: ChatThread) => t.id !== id),
      activeThreadId: s.activeThreadId === id ? null : s.activeThreadId,
      loadedMessages: [],
    }));
  },

  updateThreadTitle: (id: string, title: string) =>
    chatStore.setState((s: ChatState) => ({
      ...s,
      threads: s.threads.map((t: ChatThread) => (t.id === id ? { ...t, title } : t)),
    })),

  toggleSidebar: () =>
    chatStore.setState((s: ChatState) => {
      const next = !s.isSidebarOpen;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "open" : "closed");
      return { ...s, isSidebarOpen: next };
    }),

  setChatWidth: (width: number) => {
    const clamped = clampWidth(width);
    localStorage.setItem(WIDTH_STORAGE_KEY, String(clamped));
    chatStore.setState((s: ChatState) => ({ ...s, chatWidth: clamped }));
  },

  queueAssistantHandoff: (seed: { items: AssistantHandoffItem[]; promptText?: string | null }) =>
    chatStore.setState((s: ChatState) => ({
      ...s,
      pendingAssistantHandoff: {
        nonce: (s.pendingAssistantHandoff?.nonce ?? 0) + 1,
        items: dedupeAssistantHandoffItems([
          ...(s.pendingAssistantHandoff?.items ?? []),
          ...seed.items,
        ]),
        promptText:
          [s.pendingAssistantHandoff?.promptText, seed.promptText]
            .filter((value): value is string => Boolean(value?.trim()))
            .join("\n\n") || null,
      },
    })),

  clearPendingAssistantHandoff: () =>
    chatStore.setState((s: ChatState) => ({ ...s, pendingAssistantHandoff: null })),
};

// ---------------------------------------------------------------------------
// Async actions — plain async functions that read/write the store directly
// ---------------------------------------------------------------------------

export async function loadThreads(): Promise<void> {
  const res = await fetch(API_ROUTES.chatConversations);
  const data = (await res.json()) as ChatThread[];
  if (!Array.isArray(data)) return;

  if (data.length > 0 && data[0]) {
    chatActions.setThreads(data);
    const storedId = readInitialActiveThread();
    const restoredThread = storedId ? data.find((t) => t.id === storedId) : null;
    chatActions.setActiveThreadId(restoredThread ? restoredThread.id : data[0].id);
  } else {
    // Fresh install — eagerly create a thread so the composer always has a conversationId
    const r = await fetch(API_ROUTES.chatConversations, { method: "POST" });
    if (r.ok) {
      const thread = (await r.json()) as ChatThread;
      chatActions.addThread(thread);
    }
  }
}

export async function loadMessages(conversationId: string): Promise<void> {
  const res = await fetch(chatConversationRoute(conversationId));
  if (!res.ok) {
    chatActions.setLoadedMessages([]);
    return;
  }
  const rows = await res.json();
  if (!Array.isArray(rows)) return;
  // biome-ignore lint/suspicious/noExplicitAny: row shapes are typed at runtime from DB
  const msgs: LlmMessage[] = (rows as any[]).map((row) => ({
    id: row.id,
    role: row.role,
    parts: parseMessageParts(row.parts),
    createdAt: new Date(row.createdAt),
  }));
  chatActions.setLoadedMessages(msgs);
}

export async function refreshThreadList(): Promise<void> {
  const res = await fetch(API_ROUTES.chatConversations);
  if (!res.ok) return;
  const data = (await res.json()) as ChatThread[];
  if (Array.isArray(data)) chatActions.setThreads(data);
}

export async function createThread(): Promise<void> {
  const res = await fetch(API_ROUTES.chatConversations, { method: "POST" });
  if (!res.ok) return;
  const thread = (await res.json()) as ChatThread;
  chatActions.addThread(thread);
}

export async function renameThread(id: string, title: string): Promise<void> {
  const res = await fetch(chatConversationRoute(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (res.ok) chatActions.updateThreadTitle(id, title);
}

export async function deleteThread(id: string): Promise<void> {
  await fetch(chatConversationRoute(id), { method: "DELETE" });
  chatActions.removeThread(id);
}

export async function ensureThread(): Promise<string> {
  const { activeThreadId } = chatStore.state;
  if (activeThreadId) return activeThreadId;

  const res = await fetch(API_ROUTES.chatConversations, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create conversation");
  const thread = (await res.json()) as ChatThread;
  chatActions.addThread(thread);
  return thread.id;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMessageParts(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [{ type: "text", text: String(raw) }];
  } catch {
    return [{ type: "text", text: String(raw) }];
  }
}
