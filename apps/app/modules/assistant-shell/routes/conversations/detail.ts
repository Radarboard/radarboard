import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmRepo } from "@/db/repository";
import { handleRoute, parseBody } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";

const conversationTitleSchema = z.object({
  title: z.string().trim().min(1),
});

export async function handleGetConversationMessages(id: string) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const repo = getLlmRepo();
      const messages = await repo.getMessages(id);
      return NextResponse.json(messages);
    },
    { context: "Failed to get messages" }
  );
}

export async function handleUpdateConversationTitle(request: Request, id: string) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = await parseBody(request, conversationTitleSchema);
      if (!parsed.ok) return parsed.response;
      const { title } = parsed.data;
      const repo = getLlmRepo();
      await repo.updateConversationTitle(id, title);
      return NextResponse.json({ success: true, title });
    },
    { context: "Failed to update conversation" }
  );
}

export async function handleDeleteConversation(id: string) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const repo = getLlmRepo();
      await repo.deleteConversation(id);
      return NextResponse.json({ success: true });
    },
    { context: "Failed to delete conversation" }
  );
}
