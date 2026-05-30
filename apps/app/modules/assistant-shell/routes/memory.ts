import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmRepo } from "@/db/repository";
import { handleRoute, parseBody, parseSearchParams } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";

const listMemoryQuerySchema = z.object({
  projectSlug: z.string().optional(),
});
const createMemorySchema = z.object({
  key: z.string().trim().min(1),
  value: z.string().trim().min(1),
  projectSlug: z.string().optional(),
});
const deleteMemorySchema = z.object({
  id: z.string().min(1),
});

export async function handleListMemory(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = parseSearchParams(new URL(request.url).searchParams, listMemoryQuerySchema);
      if (!parsed.ok) return parsed.response;
      const projectSlug = parsed.data.projectSlug ?? undefined;
      const repo = getLlmRepo();
      const memories = await repo.listMemory(projectSlug);
      return NextResponse.json(memories);
    },
    { context: "Failed to list memories" }
  );
}

export async function handleCreateMemory(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = await parseBody(request, createMemorySchema);
      if (!parsed.ok) return parsed.response;
      const { key, value } = parsed.data;
      const projectSlug = parsed.data.projectSlug ?? null;
      const repo = getLlmRepo();
      const now = new Date().toISOString();
      await repo.upsertMemory({
        id: crypto.randomUUID(),
        key,
        value,
        embedding: null,
        projectSlug,
        createdAt: now,
        updatedAt: now,
      });
      return NextResponse.json({ success: true });
    },
    { context: "Failed to save memory" }
  );
}

export async function handleDeleteMemory(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = await parseBody(request, deleteMemorySchema);
      if (!parsed.ok) return parsed.response;
      const repo = getLlmRepo();
      await repo.deleteMemory(parsed.data.id);
      return NextResponse.json({ success: true });
    },
    { context: "Failed to delete memory" }
  );
}
