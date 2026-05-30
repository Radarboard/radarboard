// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { RssReaderWidget } from "./widget";

vi.mock("@radarboard/plugin-sdk/host", () => ({
  getPluginToken: vi.fn(async () => "test-plugin-token"),
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("RssReaderWidget", () => {
  it("filters unread items by the active time range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);

        if (url.includes("key=rss:feeds")) {
          return jsonResponse({
            value: JSON.stringify([
              { id: "feed-1", name: "Docs Feed" },
              { id: "feed-2", name: "Protocol Feed" },
            ]),
          });
        }

        if (url.includes("key=rss:items")) {
          return jsonResponse({
            value: JSON.stringify([
              {
                id: "rss-recent",
                feedId: "feed-1",
                title: "Recent unread item",
                link: "https://example.com/recent",
                publishedAt: new Date().toISOString(),
                read: false,
              },
              {
                id: "rss-old",
                feedId: "feed-1",
                title: "Old unread item",
                link: "https://example.com/old",
                publishedAt: new Date(0).toISOString(),
                read: false,
              },
              {
                id: "rss-read",
                feedId: "feed-2",
                title: "Recent but already read",
                link: "https://example.com/read",
                publishedAt: new Date().toISOString(),
                read: true,
              },
            ]),
          });
        }

        throw new Error(`Unexpected fetch request: ${url}`);
      }) as typeof fetch
    );

    render(
      createElement(RssReaderWidget, {
        projectSlug: null,
        timeRange: "7d",
        config: {},
      })
    );

    expect(await screen.findByText("Recent unread item")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Old unread item")).toBeNull();
      expect(screen.queryByText("Recent but already read")).toBeNull();
    });
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });
});
