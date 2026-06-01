import { buildAssistantModePrompt } from "@radarboard/assistant-core/assistant-workflows";
import { persistUserMessageWithRuntimeContext } from "@radarboard/assistant-core/chat-helpers";
import {
  emitRejectedChatRequest,
  parseChatRequestParams,
  resolveChatRequestDependencies,
  validateChatMessages,
} from "@radarboard/assistant-core/chat-request";
import {
  resolveModelSelection as coreResolveModelSelection,
  type OAuthRefreshDependencies,
} from "@radarboard/assistant-core/provider-selection";
import { scopeProjectContext as coreScopeProjectContext } from "@radarboard/assistant-core/runtime";
import {
  buildBaseSystemPrompt as coreBuildBaseSystemPrompt,
  instrumentTools as coreInstrumentTools,
} from "@radarboard/assistant-core/tool-evidence";
import type { LlmMessage } from "@radarboard/llm/types";
import { createVercelAdapter } from "@radarboard/llm-adapter-vercel/adapter";
import { createLogger } from "@radarboard/logger/logger";
import type { LlmConfig } from "@radarboard/types/database";
import type { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo, getLlmRepo, getSettingsRepo } from "@/db/repository";
import { getAvailableToolNames } from "@/lib/ai-tools";
import { errorJson, parseBody } from "@/lib/api";
import {
  buildOnFinish as webBuildOnFinish,
  loadAttachedArtifacts as webLoadAttachedArtifacts,
  loadAttachedNotes as webLoadAttachedNotes,
} from "@/lib/assistant-route-runtime";
import { emitDebugEvent } from "@/lib/debug-events";
import { getFeatureAssistantPromptSections } from "@/lib/extensions/runtime/server/feature-server";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";
import { isExpiredOAuthToken, refreshOAuthToken } from "@/lib/oauth/refresh";
import {
  buildChatFailedDebugEvent,
  buildChatStartedDebugEvent,
} from "@/modules/assistant-shell/chat-debug";
import { buildChatRuntime } from "@/modules/assistant-shell/chat-runtime";

const log = createLogger("api/chat");

const OAUTH_DEPS: OAuthRefreshDependencies = {
  isExpiredOAuthToken,
  refreshOAuthToken: (providerId, cred, credentialRepo) =>
    refreshOAuthToken(providerId, cred as Parameters<typeof refreshOAuthToken>[1], credentialRepo),
};
const chatBodySchema = z.record(z.string(), z.unknown());

function validateMessagesOrRespond(
  body: Record<string, unknown>,
  requestId: string
): { messages: LlmMessage[] } | { response: NextResponse } {
  const validated = validateChatMessages(body);
  if (validated) {
    return validated;
  }
  log.warn("chat rejected", { reason: "missing_messages" });
  emitRejectedChatRequest(emitDebugEvent, {
    requestId,
    error: "missing messages",
    reason: "missing_messages",
  }).catch(() => {
    /* best-effort */
  });
  return { response: errorJson(400, "messages array is required") };
}

export async function handleChatRequest(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  const requestStartedAt = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const parsed = await parseBody(request, chatBodySchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const validated = validateMessagesOrRespond(body, requestId);
    if ("response" in validated) return validated.response;
    const { messages } = validated;

    const deps = await resolveChatRequestDependencies(
      body,
      messages,
      getCredentialRepo(),
      OAUTH_DEPS
    );
    if ("error" in deps) {
      log.warn("chat rejected", {
        reason: deps.reason,
        messageCount: deps.messageCount,
      });
      await emitRejectedChatRequest(emitDebugEvent, {
        requestId,
        error: deps.error,
        reason: deps.reason,
        messageCount: deps.messageCount,
      });
      return errorJson(deps.status, deps.error);
    }

    const { primarySelection, credentialRepo } = deps;
    const {
      requestedModel,
      conversationId,
      pinnedProject,
      mode,
      challengerModel,
      artifactId,
      attachedSkillIds,
      attachedArtifactIds,
      attachedNoteIds,
      attachedRuntimeContextItems,
    } = parseChatRequestParams(body);

    const settingsRepo = getSettingsRepo();
    const [fullProjectContextMap, connectedKeys, llmConfig, llmRepo] = await Promise.all([
      settingsRepo.getProjectContextMap().catch(() => ({})),
      credentialRepo.listCredentialKeys(),
      settingsRepo.getLlmConfig().catch(() => ({}) as LlmConfig),
      Promise.resolve(getLlmRepo()),
    ]);

    const projectContextMap = coreScopeProjectContext(
      fullProjectContextMap as Record<string, unknown>,
      pinnedProject
    ) as typeof fullProjectContextMap;
    const projectStage = pinnedProject
      ? // biome-ignore lint/suspicious/noExplicitAny: projectContextMap is a complex dynamic map
        (projectContextMap as any)[pinnedProject]?.stage
      : undefined;

    const {
      actionTools,
      mcpTools,
      pluginTools,
      browserToolsAvailable,
      pluginToolNames,
      dependencyArtifacts,
      pluginToolGuidance,
      lastUserText,
      skills,
      contextMetadata,
      memories,
      attachedContextSections,
      toolOriginMap,
      allTools,
    } = await buildChatRuntime({
      connectedKeys,
      llmConfig,
      llmRepo,
      mode,
      pinnedProject,
      conversationId,
      artifactId,
      attachedArtifactIds,
      attachedNoteIds,
      attachedRuntimeContextItems,
      attachedSkillIds,
      messages,
      primarySelection,
      emitDebugEvent,
      loadAttachedArtifacts: webLoadAttachedArtifacts,
      loadAttachedNotes: webLoadAttachedNotes,
    });

    const baseSystemPrompt = coreBuildBaseSystemPrompt({
      projectContextMap,
      memories,
      skills,
      pinnedProject,
      identityPrompt: llmConfig.identityPrompt,
      availableToolNames: [
        ...getAvailableToolNames(),
        ...Object.keys(actionTools),
        ...Object.keys(mcpTools),
        ...Object.keys(pluginTools),
        "remember",
        "recall",
        "forget",
        "list_memories",
        "save_artifact",
        "list_artifacts",
        "get_artifact",
        "update_skill",
        "update_project_context",
        "update_llm_config",
      ],
      extraSections: [
        ...attachedContextSections,
        ...(pluginToolGuidance ? [pluginToolGuidance] : []),
        ...getFeatureAssistantPromptSections(),
      ],
    });

    const modePrompt = buildAssistantModePrompt({
      mode,
      dependencyArtifacts,
      browserToolsAvailable,
      challengerModel,
    });
    const systemPrompt = [baseSystemPrompt, modePrompt].filter(Boolean).join("\n\n");

    const traceId = crypto.randomUUID();
    const instrumentedTools = coreInstrumentTools(
      allTools,
      toolOriginMap,
      {
        conversationId,
        mode,
        projectSlug: pinnedProject,
        requestId,
        traceId,
      },
      emitDebugEvent
    );

    log.info("chat started", {
      conversationId,
      requestedModel,
      providerId: primarySelection.providerId,
      modelId: primarySelection.modelId,
      projectSlug: pinnedProject,
      mode,
      messageCount: messages.length,
    });

    await emitDebugEvent(
      buildChatStartedDebugEvent({
        requestId,
        traceId,
        conversationId,
        projectSlug: pinnedProject,
        requestedModel,
        providerId: primarySelection.providerId,
        modelId: primarySelection.modelId,
        mode,
        challengerModel,
        attachedSkillIds,
        attachedArtifactIds,
        attachedNoteIds,
        dependencyArtifactIds: dependencyArtifacts.map((artifact) => artifact.id),
        browserToolsAvailable,
        pluginToolNames,
        messageCount: messages.length,
        contextMetadata,
      })
    );

    const lastUser = messages[messages.length - 1];
    await persistUserMessageWithRuntimeContext(
      llmRepo,
      conversationId,
      lastUser,
      attachedRuntimeContextItems
    );

    const adapter = createVercelAdapter();
    return adapter.streamChat({
      providerId: primarySelection.providerId,
      apiKey: primarySelection.apiKey,
      model: primarySelection.modelId,
      messages,
      systemPrompt,
      nativeTools: instrumentedTools,
      onFinish: webBuildOnFinish({
        llmRepo,
        credentialRepo,
        conversationId,
        messages,
        lastUserText,
        providerId: primarySelection.providerId,
        modelId: primarySelection.modelId,
        startedAt: Date.now(),
        projectSlug: pinnedProject,
        projectStage,
        requestId,
        traceId,
        mode,
        contextMetadata,
        dependencyArtifacts,
        browserToolsAvailable,
        challengerModel,
        primarySelection,
        resolveModelSelection: (requested, fallbackSelection, repo) =>
          coreResolveModelSelection(requested, fallbackSelection, repo, OAUTH_DEPS),
      }),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - requestStartedAt;
    log.error("chat failed", { error: detail, durationMs });
    await emitDebugEvent(
      buildChatFailedDebugEvent({
        requestId,
        detail,
        durationMs,
      })
    );
    return errorJson(500, `Chat failed: ${detail}`);
  }
}
