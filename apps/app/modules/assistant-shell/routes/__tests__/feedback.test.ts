import { beforeEach, describe, expect, it, vi } from "vitest";

const emitDebugEventMock = vi.fn().mockResolvedValue("evt-1");

vi.mock("@/lib/features", () => ({
  isFeatureEnabled: () => true,
  featureNotFound: () => new Response("Not Found", { status: 404 }),
}));

vi.mock("@/lib/debug-events", () => ({
  emitDebugEvent: (input: unknown) => emitDebugEventMock(input),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { handleChatFeedback } from "../feedback";

beforeEach(() => vi.clearAllMocks());

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/chat/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("handleChatFeedback", () => {
  describe("vote", () => {
    it("records an upvote", async () => {
      const res = await handleChatFeedback(
        makeRequest({ kind: "vote", messageId: "msg-1", vote: "up" })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(emitDebugEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "assistant.response.feedback.upvote",
          entityId: "msg-1",
          metadata: { vote: "up" },
        })
      );
    });

    it("records a downvote with warn level", async () => {
      await handleChatFeedback(makeRequest({ kind: "vote", messageId: "msg-1", vote: "down" }));

      expect(emitDebugEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "warn",
          eventType: "assistant.response.feedback.downvote",
        })
      );
    });

    it("clears feedback when vote is null", async () => {
      const res = await handleChatFeedback(
        makeRequest({ kind: "vote", messageId: "msg-1", vote: null })
      );

      expect(res.status).toBe(200);
      expect(emitDebugEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "assistant.response.feedback.cleared",
        })
      );
    });

    it("rejects invalid vote value", async () => {
      const res = await handleChatFeedback(
        makeRequest({ kind: "vote", messageId: "msg-1", vote: "maybe" })
      );

      expect(res.status).toBe(400);
    });

    it("includes conversationId when provided", async () => {
      await handleChatFeedback(
        makeRequest({
          kind: "vote",
          messageId: "msg-1",
          vote: "up",
          conversationId: "conv-abc",
        })
      );

      expect(emitDebugEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: "conv-abc" })
      );
    });
  });

  describe("detail", () => {
    it("records feedback with reason tag", async () => {
      const res = await handleChatFeedback(
        makeRequest({
          kind: "detail",
          messageId: "msg-1",
          reasonTag: "wrong",
        })
      );

      expect(res.status).toBe(200);
      expect(emitDebugEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "assistant.response.feedback.detail",
          metadata: expect.objectContaining({ reasonTag: "wrong" }),
        })
      );
    });

    it("records feedback with note", async () => {
      await handleChatFeedback(
        makeRequest({
          kind: "detail",
          messageId: "msg-1",
          note: "The code had a syntax error",
        })
      );

      expect(emitDebugEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            note: "The code had a syntax error",
          }),
        })
      );
    });

    it("truncates note to 2000 chars", async () => {
      const longNote = "x".repeat(3000);
      await handleChatFeedback(
        makeRequest({
          kind: "detail",
          messageId: "msg-1",
          note: longNote,
        })
      );

      const metadata = emitDebugEventMock.mock.calls[0][0].metadata;
      expect(metadata.note.length).toBe(2000);
    });

    it("rejects invalid reason tag", async () => {
      const res = await handleChatFeedback(
        makeRequest({
          kind: "detail",
          messageId: "msg-1",
          reasonTag: "spam",
        })
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/reasonTag/);
    });

    it("rejects detail with neither reason nor note", async () => {
      const res = await handleChatFeedback(makeRequest({ kind: "detail", messageId: "msg-1" }));

      expect(res.status).toBe(400);
    });
  });

  describe("validation", () => {
    it("rejects missing kind", async () => {
      const res = await handleChatFeedback(makeRequest({ messageId: "msg-1", vote: "up" }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/kind/);
    });

    it("rejects missing messageId", async () => {
      const res = await handleChatFeedback(makeRequest({ kind: "vote", vote: "up" }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/messageId/);
    });

    it("rejects empty messageId", async () => {
      const res = await handleChatFeedback(
        makeRequest({ kind: "vote", messageId: "  ", vote: "up" })
      );

      expect(res.status).toBe(400);
    });
  });
});
