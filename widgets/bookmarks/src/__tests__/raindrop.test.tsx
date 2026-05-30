// @vitest-environment jsdom
import type { RaindropResponse } from "@radarboard/types/raindrop";
import { Dialog, DialogContent } from "@radarboard/ui/app-dialog";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";
import { raindropDescriptor } from "..";
import { RaindropBookmarkDetail } from "../details/raindrop-bookmark-detail";

const mockUseRaindrop = vi.fn();
const mockSendToAssistant = vi.fn();
const mockCopyText = vi.fn();

vi.mock("../hooks/use-raindrop", () => ({
  useRaindrop: (...args: unknown[]) => mockUseRaindrop(...args),
}));

vi.mock("@radarboard/assistant-ui/assistant-handoff", () => ({
  buildAssistantHandoffPrompt: vi.fn(() => "Summarize this bookmark."),
  SendToAssistantButton: ({ item, promptTemplate }: { item: unknown; promptTemplate?: string }) => (
    <button
      type="button"
      onClick={() => {
        mockSendToAssistant({ item, promptTemplate });
      }}
    >
      Discuss with Assistant
    </button>
  ),
}));

vi.mock("@radarboard/utils/clipboard", () => ({
  copyText: (...args: unknown[]) => mockCopyText(...args),
}));

const FIXTURE: RaindropResponse = {
  configured: true,
  source: "api",
  summary: {
    savedCount: 42,
    totalCollections: 6,
    totalTags: 12,
    recentCount: 5,
  },
  recent: [
    {
      id: 1,
      title: "Raindrop Docs",
      excerpt: "Official documentation",
      link: "https://developer.raindrop.io",
      domain: "developer.raindrop.io",
      created: "2026-03-19T12:00:00.000Z",
      lastUpdate: "2026-03-19T12:00:00.000Z",
      tags: ["docs", "api"],
      important: true,
      collectionId: 101,
      collectionTitle: "Reference",
      collectionUrl: "https://app.raindrop.io/my/101",
      raindropUrl: "https://app.raindrop.io/my/0/item/1",
      coverUrl: "https://rdl.ink/render/preview-1.jpg",
    },
    {
      id: 2,
      title: "MCP Guide",
      excerpt: "",
      link: "https://modelcontextprotocol.io",
      domain: "modelcontextprotocol.io",
      created: "2026-03-18T12:00:00.000Z",
      lastUpdate: "2026-03-18T12:00:00.000Z",
      tags: ["mcp"],
      important: false,
      collectionId: 102,
      collectionTitle: "Protocols",
      collectionUrl: "https://app.raindrop.io/my/102",
      raindropUrl: "https://app.raindrop.io/my/0/item/2",
      coverUrl: null,
    },
  ],
  collections: [
    {
      id: 101,
      title: "Reference",
      count: 18,
      color: "#5b8af5",
      parentId: null,
      lastUpdate: "2026-03-19T12:00:00.000Z",
      collectionUrl: "https://app.raindrop.io/my/101",
    },
  ],
  topTags: [
    { name: "docs", count: 8 },
    { name: "api", count: 5 },
  ],
};

describe("raindropDescriptor", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/dashboard");
    mockSendToAssistant.mockReset();
    mockCopyText.mockReset();
    mockCopyText.mockResolvedValue(undefined);
    mockUseRaindrop.mockReturnValue({
      data: FIXTURE,
      configured: true,
      fetchedAt: 1_700_000_000,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
  });

  it("renders recent bookmarks and summary metrics in the compact view", async () => {
    render(
      createElement(raindropDescriptor.component, {
        widgetId: raindropDescriptor.id,
        projectSlug: null,
        config: raindropDescriptor.defaultConfig,
      })
    );

    expect(await screen.findAllByText("Saved")).toHaveLength(2);
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Raindrop Docs")).toBeTruthy();
    expect(screen.getByText("developer.raindrop.io")).toBeTruthy();
    expect(screen.getByText("Reference")).toBeTruthy();
  });

  it("passes the active dashboard time range into the Raindrop hook", async () => {
    render(
      createElement(raindropDescriptor.component, {
        widgetId: raindropDescriptor.id,
        projectSlug: null,
        timeRange: "7d",
        config: raindropDescriptor.defaultConfig,
      })
    );

    expect(mockUseRaindrop).toHaveBeenCalledWith("7d");
    expect((await screen.findAllByText("Raindrop Docs")).length).toBeGreaterThan(0);
  });

  it("renders recent and collections content in the expanded view", async () => {
    const ExpandedComponent = raindropDescriptor.expandedComponent;
    if (!ExpandedComponent) {
      throw new Error("Raindrop widget must provide an expanded component");
    }

    render(
      createElement(ExpandedComponent, {
        widgetId: raindropDescriptor.id,
        projectSlug: null,
        config: raindropDescriptor.defaultConfig,
      })
    );

    expect(await screen.findByRole("tab", { name: /Recent/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Collections/i })).toBeTruthy();
    expect(window.location.search).toContain("raindropView=cards");

    fireEvent.click(screen.getAllByRole("tab", { name: /Table/i })[0] as HTMLElement);

    expect(window.location.search).toContain("raindropView=table");
    expect((await screen.findAllByText("Raindrop Docs")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: /Collections/i }));

    expect((await screen.findAllByText("Reference")).length).toBeGreaterThan(0);
    expect(screen.getByText("docs")).toBeTruthy();
  });

  it("offers bookmark links and copy-url action in the detail view", async () => {
    vi.spyOn(window, "setTimeout").mockImplementation(() => 0 as ReturnType<typeof setTimeout>);

    render(
      createElement(
        Dialog,
        { open: true },
        createElement(
          DialogContent,
          { "aria-describedby": undefined },
          createElement(RaindropBookmarkDetail, {
            bookmark: FIXTURE.recent[0] as NonNullable<typeof FIXTURE.recent>[number],
          })
        )
      )
    );

    expect(screen.getByRole("link", { name: "Open Original →" }).getAttribute("href")).toBe(
      "https://developer.raindrop.io"
    );
    expect(screen.getByRole("link", { name: "Open in Raindrop →" }).getAttribute("href")).toBe(
      "https://app.raindrop.io/my/0/item/1"
    );
    expect(screen.getByRole("img", { name: "Raindrop Docs preview" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy URL" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockCopyText).toHaveBeenCalledWith("https://developer.raindrop.io");
  });

  it("offers a global send-to-assistant action in the bookmark detail view", async () => {
    render(
      createElement(
        Dialog,
        { open: true },
        createElement(
          DialogContent,
          { "aria-describedby": undefined },
          createElement(RaindropBookmarkDetail, {
            bookmark: FIXTURE.recent[0] as NonNullable<typeof FIXTURE.recent>[number],
          })
        )
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Discuss with Assistant" }));

    expect(mockSendToAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({
          kind: "bookmark",
          title: "Raindrop Docs",
          sourceUrl: "https://developer.raindrop.io",
        }),
      })
    );
  });
});
