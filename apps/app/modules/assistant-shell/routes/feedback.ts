import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson } from "@/lib/api";
import { emitDebugEvent } from "@/lib/debug-events";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";

const log = createLogger("api/chat/feedback");
const ALLOWED_REASON_TAGS = new Set(["wrong", "incomplete", "tooLong", "other"]);
const MAX_NOTE_CHARS = 2_000;
const feedbackBodySchema = z.record(z.string(), z.unknown());

type FeedbackBody = Record<string, unknown>;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parseConversationId(body: FeedbackBody): string | null {
  if (body.conversationId === null || body.conversationId === undefined) {
    return null;
  }
  if (typeof body.conversationId === "string") {
    return body.conversationId;
  }
  return null;
}

const VOTE_EVENT_TYPES: Record<string, string> = {
  up: "assistant.response.feedback.upvote",
  down: "assistant.response.feedback.downvote",
};

async function recordVote(
  conversationId: string | null,
  messageId: string,
  vote: "up" | "down" | null
): Promise<void> {
  const eventType = vote
    ? (VOTE_EVENT_TYPES[vote] ?? "assistant.response.feedback.vote")
    : "assistant.response.feedback.cleared";
  await emitDebugEvent({
    level: vote === "down" ? "warn" : "info",
    source: "api/chat/feedback",
    eventType,
    message:
      vote === null ? "Assistant message feedback cleared" : `Assistant message feedback: ${vote}`,
    conversationId,
    entityType: "llm_message",
    entityId: messageId,
    metadata: { vote },
  });
}

async function recordDetail(
  conversationId: string | null,
  messageId: string,
  reasonTag: string | undefined,
  note: string | undefined
): Promise<void> {
  await emitDebugEvent({
    level: "info",
    source: "api/chat/feedback",
    eventType: "assistant.response.feedback.detail",
    message: "Assistant message feedback detail",
    conversationId,
    entityType: "llm_message",
    entityId: messageId,
    metadata: {
      ...(reasonTag ? { reasonTag } : {}),
      ...(note ? { note } : {}),
    },
  });
}

async function handleFeedbackVote(
  body: FeedbackBody,
  conversationId: string | null,
  messageId: string
): Promise<Response> {
  const vote = body.vote;
  if (vote !== "up" && vote !== "down" && vote !== null) {
    return errorJson(400, "vote must be up, down, or null");
  }
  await recordVote(conversationId, messageId, vote);
  return NextResponse.json({ ok: true });
}

async function handleFeedbackDetail(
  body: FeedbackBody,
  conversationId: string | null,
  messageId: string
): Promise<Response> {
  let reasonTag: string | undefined;
  if (body.reasonTag !== undefined && body.reasonTag !== null) {
    if (typeof body.reasonTag !== "string" || !ALLOWED_REASON_TAGS.has(body.reasonTag)) {
      return errorJson(400, "invalid reasonTag");
    }
    reasonTag = body.reasonTag;
  }
  let note: string | undefined;
  if (typeof body.note === "string" && body.note.trim()) {
    note = body.note.trim().slice(0, MAX_NOTE_CHARS);
  }
  if (!reasonTag && !note) {
    return errorJson(400, "reasonTag or note is required for detail");
  }

  await recordDetail(conversationId, messageId, reasonTag, note);
  return NextResponse.json({ ok: true });
}

async function handleFeedbackPayload(body: FeedbackBody): Promise<Response> {
  const kind = body.kind === "vote" || body.kind === "detail" ? body.kind : null;
  if (!kind) {
    return errorJson(400, "kind must be vote or detail");
  }
  const messageId = isNonEmptyString(body.messageId) ? body.messageId.trim() : "";
  if (!messageId) {
    return errorJson(400, "messageId is required");
  }
  const conversationId = parseConversationId(body);
  if (kind === "vote") {
    return handleFeedbackVote(body, conversationId, messageId);
  }
  return handleFeedbackDetail(body, conversationId, messageId);
}

export async function handleChatFeedback(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  try {
    let raw: unknown = {};
    try {
      raw = await request.json();
    } catch {
      raw = {};
    }
    const parsed = feedbackBodySchema.safeParse(raw);
    return await handleFeedbackPayload(parsed.success ? parsed.data : {});
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log.error(`Failed to record feedback: ${detail}`, { error: err });
    return errorJson(500, `Failed to record feedback: ${detail}`);
  }
}
