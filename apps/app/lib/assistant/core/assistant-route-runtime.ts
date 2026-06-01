import {
  buildArtifactRecord,
  buildChallengerPrompt,
  isWorkflowMode,
  recommendNextMode,
} from "@radarboard/assistant-core/assistant-workflows";
import type { AttachedNoteRecord } from "@radarboard/assistant-core/tool-evidence";
import "@/lib/integrations-init";
import { findDataSource } from "@radarboard/integration-sdk/registry";
import { createVercelAdapter } from "@radarboard/llm-adapter-vercel/adapter";
import type {
  AssistantArtifactRow,
  AssistantEvidenceRef,
  AssistantMode,
  CredentialRepository,
  LlmRepository,
} from "@radarboard/types/database";
import { getPluginRepo } from "@/data/core/repository";
import { buildDataSourceContext } from "@/lib/data-source-context";
import { emitDebugEvent, queryDebugEvents } from "@/lib/debug-events";

export async function loadAttachedArtifacts(
  llmRepo: LlmRepository,
  artifactIds: string[]
): Promise<AssistantArtifactRow[]> {
  if (artifactIds.length === 0) return [];

  const artifacts = await Promise.all(
    artifactIds.map((artifactId) => llmRepo.getArtifact(artifactId))
  );
  return artifacts.filter((artifact): artifact is AssistantArtifactRow => artifact !== null);
}

export async function loadAttachedNotes(noteIds: string[]): Promise<AttachedNoteRecord[]> {
  if (noteIds.length === 0) return [];

  const pluginRepo = getPluginRepo();
  const rawNotes = await pluginRepo.get("notes", "notes:list");
  if (!rawNotes) return [];

  try {
    const parsed = JSON.parse(rawNotes) as AttachedNoteRecord[];
    const byId = new Map(parsed.map((note) => [note.id, note]));
    return noteIds
      .map((noteId) => byId.get(noteId))
      .filter((note): note is AttachedNoteRecord => Boolean(note));
  } catch {
    return [];
  }
}

export async function autoTitleConversation(
  llmRepo: LlmRepository,
  conversationId: string,
  firstMessageText: string
): Promise<void> {
  const title =
    firstMessageText.length > 50 ? `${firstMessageText.slice(0, 47)}...` : firstMessageText;
  await llmRepo.updateConversationTitle(conversationId, title).catch(() => {
    // Non-critical
  });
}

async function loadRecentShippingCount(projectSlug: string | null): Promise<number> {
  if (!projectSlug) return 0;
  try {
    const dataSource = findDataSource("shipping", "data");
    if (!dataSource) return 0;

    const result = (await dataSource.fetch(
      {
        projectSlug,
        limit: 5,
        range: "30d",
        timeZone: "UTC",
        forceRefresh: false,
      },
      buildDataSourceContext()
    )) as { items?: unknown[] };

    return Array.isArray(result.items) ? result.items.length : 0;
  } catch {
    return 0;
  }
}

async function loadRecentErrorCount(
  projectSlug: string | null,
  conversationId: string
): Promise<number> {
  try {
    const events = await queryDebugEvents({
      level: "error",
      ...(projectSlug ? { projectSlug } : { conversationId }),
      limit: 20,
    });
    return events.length;
  } catch {
    return 0;
  }
}

async function collectTraceEvidenceRefs(traceId: string): Promise<AssistantEvidenceRef[]> {
  try {
    const events = await queryDebugEvents({
      traceId,
      eventType: "chat.tool.completed",
      limit: 200,
    });

    return [
      ...new Map(
        events
          .flatMap((event) => {
            if (
              !event.metadata ||
              typeof event.metadata !== "object" ||
              !("evidence" in event.metadata) ||
              !event.metadata.evidence ||
              typeof event.metadata.evidence !== "object" ||
              !("refs" in event.metadata.evidence)
            ) {
              return [];
            }
            const refs = (event.metadata.evidence as { refs?: unknown }).refs;
            if (!Array.isArray(refs)) return [];
            return refs
              .filter(
                (
                  item
                ): item is { kind: AssistantEvidenceRef["kind"]; label: string; url?: string } =>
                  Boolean(item) &&
                  typeof item === "object" &&
                  typeof (item as { label?: unknown }).label === "string"
              )
              .map((item) => ({
                kind: item.kind,
                label: item.label,
                ...(item.url ? { url: item.url } : {}),
              }));
          })
          .map((ref) => [`${ref.kind}:${ref.label}:${ref.url ?? ""}`, ref] as const)
      ).values(),
    ];
  } catch {
    return [];
  }
}

export async function finalizeWorkflowArtifact(params: {
  llmRepo: LlmRepository;
  credentialRepo: CredentialRepository;
  requestId: string;
  traceId: string;
  mode: AssistantMode;
  conversationId: string;
  projectSlug: string | null;
  projectStage?: string;
  createdAt: string;
  body: string;
  dependencyArtifacts: AssistantArtifactRow[];
  contextMetadata: Record<string, unknown>;
  browserToolsAvailable: boolean;
  challengerModel: string | null;
  primarySelection: { providerId: string; apiKey: string; modelId: string };
  resolveModelSelection: (
    requestedModel: string | null,
    fallback: { providerId: string; apiKey: string },
    credentialRepo: CredentialRepository
  ) => Promise<{ providerId: string; apiKey: string; modelId: string }>;
}) {
  const artifactStartedAt = Date.now();

  try {
    const evidenceRefs = await collectTraceEvidenceRefs(params.traceId);
    let artifactBody = params.body.trim();

    if (params.mode === "review" && params.challengerModel) {
      await emitDebugEvent({
        level: "info",
        source: "api/chat",
        eventType: "chat.challenger.started",
        message: "Challenger review started",
        projectSlug: params.projectSlug,
        traceId: params.traceId,
        requestId: params.requestId,
        conversationId: params.conversationId,
        status: "started",
        metadata: {
          challengerModel: params.challengerModel,
          mode: params.mode,
          context: params.contextMetadata,
        },
      });

      try {
        const challenger = await params.resolveModelSelection(
          params.challengerModel,
          params.primarySelection,
          params.credentialRepo
        );
        const adapter = createVercelAdapter();
        const challengerResult = await adapter.generateText({
          providerId: challenger.providerId,
          apiKey: challenger.apiKey,
          model: challenger.modelId,
          systemPrompt:
            "You are a blunt second-opinion review model. Challenge weak assumptions and isolate unique findings.",
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              parts: [
                {
                  type: "text",
                  text: buildChallengerPrompt({
                    primaryReview: artifactBody,
                    dependencyArtifacts: params.dependencyArtifacts,
                  }),
                },
              ],
              createdAt: new Date(),
            },
          ],
        });

        artifactBody = `${artifactBody}\n\n---\n\n## Challenger Comparison\n\n${challengerResult.text.trim()}`;

        await emitDebugEvent({
          level: "info",
          source: "api/chat",
          eventType: "chat.challenger.completed",
          message: "Challenger review completed",
          projectSlug: params.projectSlug,
          traceId: params.traceId,
          requestId: params.requestId,
          conversationId: params.conversationId,
          status: "completed",
          metadata: {
            challengerModel: params.challengerModel,
            mode: params.mode,
            context: params.contextMetadata,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        artifactBody = `${artifactBody}\n\n---\n\n## Challenger Comparison\n\nUnable to complete challenger review: ${message}`;

        await emitDebugEvent({
          level: "warn",
          source: "api/chat",
          eventType: "chat.challenger.failed",
          message: "Challenger review failed",
          projectSlug: params.projectSlug,
          traceId: params.traceId,
          requestId: params.requestId,
          conversationId: params.conversationId,
          status: "failed",
          metadata: {
            challengerModel: params.challengerModel,
            error: message,
            context: params.contextMetadata,
          },
        });
      }
    }

    const [recentErrorCount, recentShippingCount] = await Promise.all([
      loadRecentErrorCount(params.projectSlug, params.conversationId),
      loadRecentShippingCount(params.projectSlug),
    ]);

    const draftArtifact = buildArtifactRecord({
      id: crypto.randomUUID(),
      mode: params.mode,
      projectSlug: params.projectSlug,
      sourceConversationId: params.conversationId,
      body: artifactBody,
      createdAt: params.createdAt,
      nextMode: null,
      nextReason: null,
      evidenceRefs,
    });

    const recommendation = recommendNextMode({
      mode: params.mode,
      status: draftArtifact.status,
      projectStage: params.projectStage,
      recentErrorCount,
      recentShippingCount,
      browserToolsAvailable: params.browserToolsAvailable,
      dependencyArtifacts: params.dependencyArtifacts,
    });

    const artifact = buildArtifactRecord({
      id: draftArtifact.id,
      mode: params.mode,
      projectSlug: params.projectSlug,
      sourceConversationId: params.conversationId,
      body: artifactBody,
      createdAt: params.createdAt,
      nextMode: recommendation.nextMode,
      nextReason: recommendation.nextReason,
      evidenceRefs,
    });

    await params.llmRepo.upsertArtifact(artifact);

    await emitDebugEvent({
      level: "info",
      source: "api/chat",
      eventType: "chat.artifact.saved",
      message: "Workflow artifact saved",
      projectSlug: params.projectSlug,
      traceId: params.traceId,
      requestId: params.requestId,
      conversationId: params.conversationId,
      entityType: "artifact",
      entityId: artifact.id,
      status: artifact.status,
      durationMs: Date.now() - artifactStartedAt,
      metadata: {
        artifact: {
          id: artifact.id,
          title: artifact.title,
          mode: artifact.mode,
          status: artifact.status,
          evidenceRefCount: artifact.evidenceRefs.length,
        },
        recommendation: {
          nextMode: artifact.nextMode,
          nextReason: artifact.nextReason,
          recentErrorCount,
          recentShippingCount,
        },
        evidence: {
          refCount: artifact.evidenceRefs.length,
          refs: artifact.evidenceRefs,
        },
        context: params.contextMetadata,
      },
    });
  } catch (error) {
    await emitDebugEvent({
      level: "warn",
      source: "api/chat",
      eventType: "chat.artifact.failed",
      message: "Workflow artifact save failed",
      projectSlug: params.projectSlug,
      traceId: params.traceId,
      requestId: params.requestId,
      conversationId: params.conversationId,
      status: "failed",
      durationMs: Date.now() - artifactStartedAt,
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        mode: params.mode,
        context: params.contextMetadata,
      },
    });
  }
}

export function buildOnFinish(params: {
  llmRepo: LlmRepository;
  credentialRepo: CredentialRepository;
  conversationId: string;
  messages: { role: string }[];
  lastUserText: string;
  providerId: string;
  modelId: string;
  startedAt: number;
  projectSlug: string | null;
  projectStage?: string;
  requestId: string;
  traceId: string;
  mode: AssistantMode;
  contextMetadata: Record<string, unknown>;
  dependencyArtifacts: AssistantArtifactRow[];
  browserToolsAvailable: boolean;
  challengerModel: string | null;
  primarySelection: { providerId: string; apiKey: string; modelId: string };
  resolveModelSelection: (
    requestedModel: string | null,
    fallback: { providerId: string; apiKey: string },
    credentialRepo: CredentialRepository
  ) => Promise<{ providerId: string; apiKey: string; modelId: string }>;
}) {
  return async (result: {
    text: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  }) => {
    const durationMs = Date.now() - params.startedAt;
    const now = new Date().toISOString();

    await params.llmRepo
      .appendMessage({
        id: crypto.randomUUID(),
        conversationId: params.conversationId,
        role: "assistant",
        parts: JSON.stringify([{ type: "text", text: result.text }]),
        createdAt: now,
      })
      .catch(() => {
        // Non-critical
      });

    await params.llmRepo
      .insertTrace({
        id: params.traceId,
        conversationId: params.conversationId,
        providerId: params.providerId,
        modelId: params.modelId,
        promptTokens: result.usage?.promptTokens ?? 0,
        completionTokens: result.usage?.completionTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        durationMs,
        rating: null,
        createdAt: now,
      })
      .catch(() => {
        // Non-critical
      });

    await emitDebugEvent({
      level: "info",
      source: "api/chat",
      eventType: "chat.request.completed",
      message: "Chat request completed",
      projectSlug: params.projectSlug,
      traceId: params.traceId,
      requestId: params.requestId,
      conversationId: params.conversationId,
      entityType: "conversation",
      entityId: params.conversationId,
      status: "completed",
      durationMs,
      metadata: {
        providerId: params.providerId,
        modelId: params.modelId,
        mode: params.mode,
        messageCount: params.messages.length,
        promptTokens: result.usage?.promptTokens ?? 0,
        completionTokens: result.usage?.completionTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        context: params.contextMetadata,
      },
    });

    if (params.messages.length <= 1 && params.lastUserText) {
      await autoTitleConversation(params.llmRepo, params.conversationId, params.lastUserText);
    }

    if (isWorkflowMode(params.mode)) {
      finalizeWorkflowArtifact({
        llmRepo: params.llmRepo,
        credentialRepo: params.credentialRepo,
        requestId: params.requestId,
        traceId: params.traceId,
        mode: params.mode,
        conversationId: params.conversationId,
        projectSlug: params.projectSlug,
        projectStage: params.projectStage,
        createdAt: now,
        body: result.text,
        contextMetadata: params.contextMetadata,
        dependencyArtifacts: params.dependencyArtifacts,
        browserToolsAvailable: params.browserToolsAvailable,
        challengerModel: params.challengerModel,
        primarySelection: params.primarySelection,
        resolveModelSelection: params.resolveModelSelection,
      }).catch(() => {
        /* fire-and-forget */
      });
    }
  };
}
