import type { NewDebugEventInput } from "@/lib/debug-events";

export function buildChatStartedDebugEvent(input: {
  requestId: string;
  traceId: string;
  conversationId: string;
  projectSlug: string | null;
  requestedModel: string | null;
  providerId: string;
  modelId: string;
  mode: string;
  challengerModel: string | null;
  attachedSkillIds: string[];
  attachedArtifactIds: string[];
  attachedNoteIds: string[];
  dependencyArtifactIds: string[];
  browserToolsAvailable: boolean;
  pluginToolNames: string[];
  messageCount: number;
  contextMetadata: Record<string, unknown>;
}): NewDebugEventInput {
  return {
    level: "info",
    source: "api/chat",
    eventType: "chat.request.started",
    message: "Chat request started",
    projectSlug: input.projectSlug,
    traceId: input.traceId,
    requestId: input.requestId,
    conversationId: input.conversationId,
    entityType: "conversation",
    entityId: input.conversationId,
    status: "started",
    metadata: {
      requestedModel: input.requestedModel,
      providerId: input.providerId,
      modelId: input.modelId,
      mode: input.mode,
      challengerModel: input.challengerModel,
      attachedSkillIds: input.attachedSkillIds,
      attachedArtifactIds: input.attachedArtifactIds,
      attachedNoteIds: input.attachedNoteIds,
      dependencyArtifactIds: input.dependencyArtifactIds,
      browserToolsAvailable: input.browserToolsAvailable,
      pluginToolCount: input.pluginToolNames.length,
      pluginToolNames: input.pluginToolNames,
      messageCount: input.messageCount,
      context: input.contextMetadata,
    },
  };
}

export function buildChatFailedDebugEvent(input: {
  requestId: string;
  detail: string;
  durationMs: number;
}): NewDebugEventInput {
  return {
    level: "error",
    source: "api/chat",
    eventType: "chat.request.failed",
    message: "Chat request failed",
    requestId: input.requestId,
    status: "failed",
    durationMs: input.durationMs,
    metadata: { error: input.detail },
  };
}
