import { createLogger } from "@radarboard/logger/logger";
import type {
  AssistantArtifactContentType,
  AssistantArtifactStatus,
  AssistantEvidenceRef,
  AssistantMode,
} from "@radarboard/types/database";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmRepo } from "@/db/repository";
import { badRequest, handleRoute, notFound, parseBody, parseSearchParams } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";

const log = createLogger("api/chat/artifacts");

const WORKFLOW_MODES = new Set<AssistantMode>(["explore", "plan", "review", "qa"]);
const ARTIFACT_STATUSES = new Set<AssistantArtifactStatus>([
  "draft",
  "completed",
  "blocked",
  "needs_input",
  "failed",
]);
const artifactUpsertSchema = z.record(z.string(), z.unknown());
const artifactListQuerySchema = z.object({
  projectSlug: z.string().optional(),
  mode: z.string().optional(),
  sourceConversationId: z.string().optional(),
  limit: z.string().optional(),
});

function parseEvidenceRefKind(value: unknown): AssistantEvidenceRef["kind"] {
  return value === "entity" ||
    value === "page" ||
    value === "query" ||
    value === "repo" ||
    value === "url"
    ? value
    : "entity";
}

function parseEvidenceRefs(value: unknown): AssistantEvidenceRef[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      kind: parseEvidenceRefKind(item.kind),
      label: typeof item.label === "string" ? item.label.trim() : "",
      ...(typeof item.url === "string" ? { url: item.url.trim() } : {}),
    }))
    .filter((item) => item.label.length > 0);
}

interface ArtifactUpsertInput {
  id: string;
  projectSlug: string | null;
  mode: AssistantMode;
  title: string;
  summary: string;
  body: string;
  contentType: AssistantArtifactContentType;
  status: AssistantArtifactStatus;
  sourceConversationId: string | null;
  createdAt: string;
  nextMode: AssistantMode | null;
  nextReason: string | null;
  evidenceRefs: AssistantEvidenceRef[];
}

function parseArtifactUpsertInput(body: Record<string, unknown>): ArtifactUpsertInput {
  const mode = typeof body.mode === "string" ? body.mode : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const artifactBody = typeof body.body === "string" ? body.body.trim() : "";
  const contentType =
    typeof body.contentType === "string" &&
    (body.contentType === "markdown" ||
      body.contentType === "html" ||
      body.contentType === "mermaid")
      ? (body.contentType as AssistantArtifactContentType)
      : "markdown";
  const status = typeof body.status === "string" ? body.status : "completed";

  if (!WORKFLOW_MODES.has(mode as AssistantMode)) {
    throw badRequest("mode is required");
  }
  if (!title || !summary || !artifactBody) {
    throw badRequest("title, summary, and body are required");
  }
  if (!ARTIFACT_STATUSES.has(status as AssistantArtifactStatus)) {
    throw badRequest("invalid status");
  }

  return {
    id: typeof body.id === "string" ? body.id : crypto.randomUUID(),
    createdAt: typeof body.createdAt === "string" ? body.createdAt : new Date().toISOString(),
    projectSlug: typeof body.projectSlug === "string" ? body.projectSlug : null,
    mode: mode as AssistantMode,
    title,
    summary,
    body: artifactBody,
    contentType,
    status: status as AssistantArtifactStatus,
    sourceConversationId:
      typeof body.sourceConversationId === "string" ? body.sourceConversationId : null,
    nextMode:
      typeof body.nextMode === "string" &&
      (body.nextMode === "default" || WORKFLOW_MODES.has(body.nextMode as AssistantMode))
        ? (body.nextMode as AssistantMode)
        : null,
    nextReason: typeof body.nextReason === "string" ? body.nextReason : null,
    evidenceRefs: parseEvidenceRefs(body.evidenceRefs),
  };
}

export async function handleListArtifacts(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = parseSearchParams(new URL(request.url).searchParams, artifactListQuerySchema);
      if (!parsed.ok) return parsed.response;

      const { projectSlug, mode, sourceConversationId, limit: limitParam } = parsed.data;
      const limit = Number(limitParam ?? "10");

      const repo = getLlmRepo();
      const artifacts = await repo.listArtifacts({
        projectSlug,
        mode:
          mode && WORKFLOW_MODES.has(mode as AssistantMode) ? (mode as AssistantMode) : undefined,
        sourceConversationId,
        limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
      });

      return NextResponse.json(artifacts);
    },
    {
      context: "Failed to list artifacts",
      onError: (error) => {
        log.error("Failed to list artifacts", { error });
      },
    }
  );
}

export async function handleUpsertArtifact(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = await parseBody(request, artifactUpsertSchema);
      if (!parsed.ok) return parsed.response;
      const artifact = parseArtifactUpsertInput(parsed.data);

      const repo = getLlmRepo();
      await repo.upsertArtifact(artifact);

      return NextResponse.json(artifact);
    },
    {
      context: "Failed to save artifact",
      onError: (error) => {
        log.error("Failed to save artifact", { error });
      },
    }
  );
}

export async function handleGetArtifact(id: string) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const repo = getLlmRepo();
      const artifact = await repo.getArtifact(id);

      if (!artifact) {
        throw notFound("Artifact not found");
      }

      return NextResponse.json(artifact);
    },
    { context: "Failed to load artifact" }
  );
}
