import type { LlmMessage } from "@radarboard/llm/types";
import type { CredentialRepository } from "@radarboard/types/database";
import { parseAssistantMode } from "./assistant-workflows";
import {
  resolveModelSelection as coreResolveModelSelection,
  resolveProvider as coreResolveProvider,
  type OAuthRefreshDependencies,
} from "./provider-selection";
import {
  parseAttachedEntityIds,
  parseAttachedRuntimeContextItems,
  parseAttachedSkillIds,
} from "./tool-evidence";

interface RejectedChatRequestDependencies {
  error: string;
  status: 401;
  reason: "missing_provider_credentials";
  messageCount: number;
}

interface ResolvedChatRequestDependencies {
  primarySelection: {
    providerId: string;
    apiKey: string;
    modelId: string;
  };
  credentialRepo: CredentialRepository;
}

export function validateChatMessages(
  body: Record<string, unknown>
): { messages: LlmMessage[] } | null {
  const messages = body.messages as LlmMessage[] | undefined;
  if (messages && Array.isArray(messages) && messages.length > 0) {
    return { messages };
  }
  return null;
}

export function parseChatRequestParams(body: Record<string, unknown>) {
  return {
    requestedModel: typeof body.model === "string" ? body.model : null,
    conversationId:
      typeof body.conversationId === "string" ? body.conversationId : crypto.randomUUID(),
    pinnedProject: typeof body.pinnedProject === "string" ? body.pinnedProject : null,
    mode: parseAssistantMode(body.mode),
    challengerModel: typeof body.challengerModel === "string" ? body.challengerModel : null,
    artifactId: typeof body.artifactId === "string" ? body.artifactId : null,
    attachedSkillIds: parseAttachedSkillIds(body.attachedSkillIds),
    attachedArtifactIds: parseAttachedEntityIds(body.attachedArtifactIds),
    attachedNoteIds: parseAttachedEntityIds(body.attachedNoteIds),
    attachedRuntimeContextItems: parseAttachedRuntimeContextItems(body.attachedRuntimeContextItems),
  };
}

export async function resolveChatRequestDependencies(
  body: Record<string, unknown>,
  messages: LlmMessage[],
  credentialRepo: CredentialRepository,
  deps: OAuthRefreshDependencies
): Promise<RejectedChatRequestDependencies | ResolvedChatRequestDependencies> {
  const fallback = await coreResolveProvider(credentialRepo, deps);

  if (!fallback) {
    return {
      error: "No LLM provider configured. Add API keys in Settings > Assistant.",
      status: 401 as const,
      reason: "missing_provider_credentials" as const,
      messageCount: messages.length,
    };
  }

  const requestedModel = typeof body.model === "string" ? body.model : null;
  const primarySelection = await coreResolveModelSelection(
    requestedModel,
    fallback,
    credentialRepo,
    deps
  );

  return { primarySelection, credentialRepo };
}

export async function emitRejectedChatRequest(
  emitDebugEvent: (input: {
    level: "warn";
    source: string;
    eventType: string;
    message: string;
    requestId: string;
    status: "rejected";
    metadata: Record<string, unknown>;
  }) => Promise<unknown>,
  input: {
    requestId: string;
    error: string;
    reason: string;
    messageCount?: number;
  }
) {
  await emitDebugEvent({
    level: "warn",
    source: "api/chat",
    eventType: "chat.request.rejected",
    message: `Chat request rejected: ${input.error}`,
    requestId: input.requestId,
    status: "rejected",
    metadata: {
      reason: input.reason,
      ...(input.messageCount != null ? { messageCount: input.messageCount } : {}),
    },
  });
}
