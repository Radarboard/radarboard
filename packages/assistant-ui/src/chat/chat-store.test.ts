import { beforeEach, describe, expect, it } from "vitest";
import { chatActions, chatStore } from "./chat-store";

describe("chatStore assistant handoff queue", () => {
  beforeEach(() => {
    chatStore.setState((state) => ({
      ...state,
      pendingAssistantHandoff: null,
      pinnedProject: null,
    }));
  });

  it("queues handoff items and merges prompt text", () => {
    chatActions.queueAssistantHandoff({
      items: [
        {
          id: "seo-1",
          kind: "seo-query",
          title: "ux patterns",
          summary: "CTR 17.6%",
          bodyMarkdown: "## Query",
          metadata: {},
        },
      ],
      promptText: "Compare this query.",
    });

    chatActions.queueAssistantHandoff({
      items: [
        {
          id: "link-1",
          kind: "link",
          title: "Search Console",
          summary: "Open the GSC view",
          bodyMarkdown: "## Link",
          metadata: {},
        },
      ],
      promptText: "Summarize this link.",
    });

    expect(chatStore.state.pendingAssistantHandoff).toEqual({
      nonce: 2,
      items: [
        expect.objectContaining({ id: "seo-1", kind: "seo-query" }),
        expect.objectContaining({ id: "link-1", kind: "link" }),
      ],
      promptText: "Compare this query.\n\nSummarize this link.",
    });
  });

  it("dedupes identical runtime items", () => {
    const item = {
      id: "seo-1",
      kind: "seo-query",
      title: "ux patterns",
      summary: "CTR 17.6%",
      bodyMarkdown: "## Query",
      metadata: {},
    };

    chatActions.queueAssistantHandoff({ items: [item] });
    chatActions.queueAssistantHandoff({ items: [item] });

    expect(chatStore.state.pendingAssistantHandoff?.items).toHaveLength(1);
  });
});
