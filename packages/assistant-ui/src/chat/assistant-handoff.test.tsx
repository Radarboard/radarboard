// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { openMock, ensureThreadMock, setPinnedProjectMock, queueAssistantHandoffMock } = vi.hoisted(
  () => ({
    openMock: vi.fn(),
    ensureThreadMock: vi.fn().mockResolvedValue("conv-1"),
    setPinnedProjectMock: vi.fn(),
    queueAssistantHandoffMock: vi.fn(),
  })
);

vi.mock("./use-chat-drawer", () => ({
  useChatDrawer: () => ({
    open: openMock,
    close: vi.fn(),
    toggle: vi.fn(),
    isOpen: false,
  }),
}));

vi.mock("./chat-store", () => ({
  ensureThread: ensureThreadMock,
  chatActions: {
    setPinnedProject: setPinnedProjectMock,
    queueAssistantHandoff: queueAssistantHandoffMock,
  },
}));

import { buildAssistantHandoffPrompt, useAssistantHandoff } from "./assistant-handoff";

describe("assistant handoff", () => {
  beforeEach(() => {
    openMock.mockReset();
    ensureThreadMock.mockReset();
    ensureThreadMock.mockResolvedValue("conv-1");
    setPinnedProjectMock.mockReset();
    queueAssistantHandoffMock.mockReset();
  });

  it("opens chat, ensures a thread, and queues a structured handoff", async () => {
    const item = {
      id: "seo-1",
      kind: "seo-query",
      title: "ux patterns",
      summary: "CTR 17.6%, position 4.2",
      bodyMarkdown: "## SEO Query",
      metadata: {},
      projectSlug: "ux-patterns",
    };

    const { result } = renderHook(() => useAssistantHandoff());

    await act(async () => {
      await result.current.sendToAssistant({
        item,
        promptTemplate: "Compare this query.",
      });
    });

    expect(openMock).toHaveBeenCalled();
    expect(ensureThreadMock).toHaveBeenCalled();
    expect(setPinnedProjectMock).toHaveBeenCalledWith("ux-patterns");
    expect(queueAssistantHandoffMock).toHaveBeenCalledWith({
      items: [item],
      promptText: "Compare this query.",
    });
  });

  it("allows overriding the pinned project", async () => {
    const item = {
      id: "link-1",
      kind: "link",
      title: "Search Console",
      summary: "Discuss this SEO link.",
      bodyMarkdown: "## SEO Link",
      metadata: {},
      projectSlug: "ux-patterns",
    };

    const { result } = renderHook(() => useAssistantHandoff());

    await act(async () => {
      await result.current.sendToAssistant({
        item,
        pinProject: "goshuin-atlas",
        openChat: false,
      });
    });

    expect(openMock).not.toHaveBeenCalled();
    expect(setPinnedProjectMock).toHaveBeenCalledWith("goshuin-atlas");
  });

  it("builds prompt scaffolds for common assistant tasks", () => {
    const item = {
      id: "action-1",
      kind: "seo-recommendation",
      title: "Push the primary page into the top 3",
      summary: "Improve the ranking page.",
      bodyMarkdown: "## Recommendation",
      metadata: {},
    };

    expect(buildAssistantHandoffPrompt("evaluate-next-action", item)).toContain(
      "Push the primary page into the top 3"
    );
    expect(buildAssistantHandoffPrompt("summarize-link", item)).toContain("Link:");
  });
});
