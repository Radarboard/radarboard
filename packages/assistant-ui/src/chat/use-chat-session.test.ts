import { describe, expect, it } from "vitest";
import { buildPreparedChatRequestBody } from "./use-chat-session";

describe("buildPreparedChatRequestBody", () => {
  it("preserves the SDK message payload when adding custom chat fields", () => {
    const body = buildPreparedChatRequestBody({
      id: "chat-1",
      messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }],
      body: {},
      trigger: "submit-message",
      conversationId: "conv-1",
      model: "openai:gpt-4o",
      pinnedProject: "radarboard",
      mode: "plan",
      challengerModel: "anthropic:claude-sonnet-4-6",
    });

    expect(body).toMatchObject({
      id: "chat-1",
      trigger: "submit-message",
      conversationId: "conv-1",
      model: "openai:gpt-4o",
      pinnedProject: "radarboard",
      mode: "plan",
      challengerModel: "anthropic:claude-sonnet-4-6",
    });
    expect(body.messages).toEqual([{ role: "user", parts: [{ type: "text", text: "hi" }] }]);
  });

  it("preserves custom request body fields such as attached skill ids", () => {
    const body = buildPreparedChatRequestBody({
      id: "chat-1",
      messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }],
      body: {
        attachedSkillIds: ["revenue-analyst"],
        attachedNoteIds: ["note-1"],
        attachedArtifactIds: ["artifact-1"],
      },
      trigger: "submit-message",
    });

    expect(body).toMatchObject({
      attachedSkillIds: ["revenue-analyst"],
      attachedNoteIds: ["note-1"],
      attachedArtifactIds: ["artifact-1"],
    });
  });

  it("preserves attached runtime handoff items in the prepared request body", () => {
    const body = buildPreparedChatRequestBody({
      id: "chat-1",
      messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }],
      body: {
        attachedRuntimeContextItems: [
          {
            id: "seo-1",
            kind: "seo-query",
            title: "ux patterns",
            summary: "CTR 17.6%",
            bodyMarkdown: "## Query",
            metadata: {},
          },
        ],
      },
      trigger: "submit-message",
    });

    expect(body).toMatchObject({
      attachedRuntimeContextItems: [
        expect.objectContaining({
          id: "seo-1",
          kind: "seo-query",
          title: "ux patterns",
        }),
      ],
    });
  });
});
