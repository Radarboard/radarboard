import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmRepo } from "@/db/repository";
import { handleRoute } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";

const log = createLogger("api/chat/conversations");

const createConversationSchema = z
  .object({
    title: z.string().optional(),
    projectSlug: z.string().optional(),
  })
  .passthrough();

export async function handleListConversations() {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const repo = getLlmRepo();
      const conversations = await repo.listConversations();
      return NextResponse.json(conversations);
    },
    { context: "Failed to list conversations" }
  );
}

export async function handleCreateConversation(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      let raw: unknown = {};
      try {
        raw = await request.json();
      } catch (error) {
        log.error("Failed to parse conversation payload", { error });
        raw = {};
      }
      const body = createConversationSchema.safeParse(raw).success
        ? createConversationSchema.parse(raw)
        : {};
      const title =
        typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New chat";
      const projectSlug = typeof body.projectSlug === "string" ? body.projectSlug : null;

      const id = crypto.randomUUID();

      const repo = getLlmRepo();
      await repo.createConversation(id, title, projectSlug);

      return NextResponse.json({ id, title, projectSlug });
    },
    { context: "Failed to create conversation" }
  );
}
