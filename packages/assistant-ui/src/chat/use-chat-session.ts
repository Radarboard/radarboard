"use client";

import { useChat } from "@ai-sdk/react";
import type { LlmChatStatus, LlmMessage, LlmMessagePart } from "@radarboard/llm/types";
import { API_ROUTES } from "@radarboard/types/api-routes";
import type { AssistantHandoffItem } from "@radarboard/types/assistant";
import type { AssistantMode } from "@radarboard/types/database";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { chatStore } from "./chat-store";

const messageMetadataSchema = z.object({
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
  model: z.string().optional(),
});

type UsageInfo = { promptTokens: number; completionTokens: number; totalTokens: number };

interface PreparedSendRequestParams {
  id: string;
  messages: unknown;
  body?: Record<string, unknown>;
  trigger: string;
  messageId?: string;
  model?: string | null;
  pinnedProject?: string | null;
  mode?: AssistantMode;
  challengerModel?: string | null;
  conversationId?: string | null;
}

export function buildPreparedChatRequestBody(params: PreparedSendRequestParams) {
  return {
    ...(params.body ?? {}),
    id: params.id,
    messages: params.messages,
    trigger: params.trigger,
    ...(params.messageId ? { messageId: params.messageId } : {}),
    ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    ...(params.model ? { model: params.model } : {}),
    ...(params.pinnedProject ? { pinnedProject: params.pinnedProject } : {}),
    ...(params.mode ? { mode: params.mode } : {}),
    ...(params.challengerModel ? { challengerModel: params.challengerModel } : {}),
  };
}

/**
 * Wraps @ai-sdk/react's useChat with our own LlmMessage types using the v6 API.
 *
 * When switching adapters (e.g. to TanStack AI), only this file changes.
 * The components above this hook are adapter-agnostic.
 */
export function useChatSession(
  model?: string | null,
  initialMessages?: LlmMessage[],
  pinnedProject?: string | null,
  mode: AssistantMode = "default",
  challengerModel?: string | null
) {
  // Refs for values that should be read at request time (not captured at render time).
  const modelRef = useRef(model);
  const pinnedProjectRef = useRef(pinnedProject);
  const modeRef = useRef(mode);
  const challengerModelRef = useRef(challengerModel);
  modelRef.current = model;
  pinnedProjectRef.current = pinnedProject;
  modeRef.current = mode;
  challengerModelRef.current = challengerModel;

  // Stable transport — never recreated. Reads conversationId directly from
  // chatStore.state at request time: TanStack Store updates are synchronous,
  // so ensureThread()'s store write is always visible before sendMessage fires.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: API_ROUTES.chat,
        prepareSendMessagesRequest: ({ id, messages, body, trigger, messageId }) => ({
          body: buildPreparedChatRequestBody({
            id,
            messages,
            body,
            trigger,
            messageId,
            // Always read the freshest activeThreadId from the store —
            // avoids the stale-ref race when ensureThread() creates a thread
            // just before sendMessage() is called (no React re-render in between)
            conversationId: chatStore.state.activeThreadId,
            model: modelRef.current,
            pinnedProject: pinnedProjectRef.current,
            mode: modeRef.current,
            challengerModel: challengerModelRef.current,
          }),
        }),
      }),
    [] // stable — intentionally no deps
  );

  // Convert our LlmMessages to AI SDK UIMessage shape for seeding
  const seedMessages = useMemo(() => {
    if (!initialMessages || initialMessages.length === 0) return undefined;
    return initialMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: m.parts.map((p) => {
        if (p.type === "text") return { type: "text" as const, text: p.text };
        return { type: "text" as const, text: "" };
      }),
    }));
  }, [initialMessages]);

  const {
    messages: rawMessages,
    sendMessage,
    stop,
    status,
    error: chatError,
    regenerate: sdkRegenerate,
    setMessages: sdkSetMessages,
    resumeStream: sdkResumeStream,
    clearError: sdkClearError,
  } = useChat({ transport, messages: seedMessages, messageMetadataSchema });

  // Sync useChat's internal message state with the store's loadedMessages.
  //
  // useChat only seeds messages on first render and doesn't react to later
  // seedMessages changes. When switching threads, chat-store.ts clears
  // loadedMessages atomically with the activeThreadId change, causing
  // seedMessages to become undefined → this effect clears rawMessages.
  // When loadMessages() then resolves and seedMessages updates, this effect
  // fires again and populates rawMessages with the correct thread's history.
  //
  // Note: seedMessages only updates when loadedMessages changes (thread switch),
  // never during streaming, so this never overwrites in-progress responses.
  const prevSeedMessagesRef = useRef(seedMessages);
  useEffect(() => {
    if (prevSeedMessagesRef.current === seedMessages) return;
    prevSeedMessagesRef.current = seedMessages;
    sdkSetMessages(seedMessages ?? []);
  }, [seedMessages, sdkSetMessages]);

  // Convert AI SDK UIMessage[] → our LlmMessage[] (preserving tool calls + results + model)
  const messages = useMemo((): LlmMessage[] => {
    return rawMessages.map((m) => {
      const parts = convertRawParts(m.parts ?? []);
      const meta = (m as unknown as { metadata?: { usage?: UsageInfo; model?: string } })?.metadata;
      return {
        id: m.id,
        role: m.role as LlmMessage["role"],
        parts,
        createdAt: new Date(),
        model: meta?.model,
      };
    });
  }, [rawMessages]);

  const wrappedSendMessage = (
    text: string,
    images?: { dataUrl: string; mimeType: string }[],
    options?: {
      artifactIds?: string[];
      noteIds?: string[];
      skillIds?: string[];
      runtimeItems?: AssistantHandoffItem[];
    }
  ) => {
    const parts = buildMessageParts(text, images);
    const body = buildSendBody(options);
    sendMessage(
      { role: "user", parts } as Parameters<typeof sendMessage>[0],
      body ? { body } : undefined
    );
  };

  const lastUsage = useMemo((): UsageInfo | null => {
    const last = [...rawMessages].reverse().find((m) => m.role === "assistant");
    const meta = (last as unknown as { metadata?: { usage?: UsageInfo } } | undefined)?.metadata;
    return meta?.usage ?? null;
  }, [rawMessages]);

  const totalUsage = useMemo((): UsageInfo | null => {
    let promptTokens = 0;
    let completionTokens = 0;
    for (const m of rawMessages) {
      if (m.role !== "assistant") continue;
      const meta = (m as unknown as { metadata?: { usage?: UsageInfo } })?.metadata;
      if (meta?.usage) {
        promptTokens += meta.usage.promptTokens;
        completionTokens += meta.usage.completionTokens;
      }
    }
    if (promptTokens === 0 && completionTokens === 0) return null;
    return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
  }, [rawMessages]);

  const getChatStatus = (): LlmChatStatus => {
    if (status === "streaming") return "streaming";
    if (status === "submitted") return "submitted";
    if (status === "error") return "error";
    return "ready";
  };
  const chatStatus = getChatStatus();

  const clearMessages = () => sdkSetMessages([]);

  const truncateMessagesAfter = (messageId: string): string | null => {
    const idx = rawMessages.findIndex((m) => m.id === messageId);
    if (idx >= 0) {
      sdkSetMessages(rawMessages.slice(0, idx));
      return messageId;
    }
    return null;
  };

  return {
    messages,
    sendMessage: wrappedSendMessage,
    stop,
    status: chatStatus,
    error: chatError ?? null,
    lastUsage,
    totalUsage,
    regenerate: () => sdkRegenerate(),
    resumeStream: () => sdkResumeStream(),
    clearMessages,
    truncateMessagesAfter,
    clearError: sdkClearError,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMessageParts(
  text: string,
  images?: { dataUrl: string; mimeType: string }[]
): Array<{ type: string; [key: string]: unknown }> {
  const parts: Array<{ type: string; [key: string]: unknown }> = [{ type: "text", text }];
  if (images?.length) {
    for (const img of images) {
      parts.push({ type: "image", image: img.dataUrl });
    }
  }
  return parts;
}

function buildSendBody(options?: {
  artifactIds?: string[];
  noteIds?: string[];
  skillIds?: string[];
  runtimeItems?: unknown[];
}): Record<string, unknown> | null {
  if (!options) return null;
  const body: Record<string, unknown> = {};
  if (options.skillIds?.length) body.attachedSkillIds = options.skillIds;
  if (options.noteIds?.length) body.attachedNoteIds = options.noteIds;
  if (options.artifactIds?.length) body.attachedArtifactIds = options.artifactIds;
  if (options.runtimeItems?.length) body.attachedRuntimeContextItems = options.runtimeItems;
  return Object.keys(body).length > 0 ? body : null;
}

function convertToolPart(part: Record<string, unknown>): LlmMessagePart {
  const getToolName = () => {
    if (typeof part.toolName === "string") return part.toolName;
    if (part.type !== "dynamic-tool") return String(part.type).slice(5);
    return "unknown";
  };
  const toolName = getToolName();
  const toolCallId = typeof part.toolCallId === "string" ? part.toolCallId : "";
  const state = typeof part.state === "string" ? part.state : "";

  if (state === "output-available" || state === "output-error") {
    return {
      type: "tool-result",
      toolCallId,
      toolName,
      output: part.output,
      isError: state === "output-error",
    };
  }
  return { type: "tool-call", toolCallId, toolName, input: part.input ?? part.args };
}

function convertRawParts(rawParts: unknown[]): LlmMessagePart[] {
  const parts: LlmMessagePart[] = [];

  for (const p of rawParts) {
    const part = p as Record<string, unknown>;
    if (part.type === "text" && typeof part.text === "string") {
      parts.push({ type: "text", text: part.text });
    } else if (
      typeof part.type === "string" &&
      (part.type.startsWith("tool-") || part.type === "dynamic-tool")
    ) {
      parts.push(convertToolPart(part));
    }
  }

  return parts;
}
