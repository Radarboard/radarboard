import { describe, expect, it, vi } from "vitest";
import { discoverFeedFromUrl } from "./discovery";

describe("discoverFeedFromUrl", () => {
  it("accepts a direct feed URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<?xml version="1.0"?><rss><channel><title>Feed</title></channel></rss>', {
        status: 200,
        headers: { "Content-Type": "application/rss+xml" },
      })
    );

    const result = await discoverFeedFromUrl("https://example.com/feed.xml", fetchMock);

    expect(result).toEqual({
      requestedUrl: "https://example.com/feed.xml",
      feedUrl: "https://example.com/feed.xml",
      method: "direct",
    });
  });

  it("discovers a feed from an HTML alternate link", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        async () =>
          new Response(
            '<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml" /></head></html>',
            {
              status: 200,
              headers: { "Content-Type": "text/html" },
            }
          )
      )
      .mockImplementationOnce(
        async () =>
          new Response('<?xml version="1.0"?><rss><channel><title>Feed</title></channel></rss>', {
            status: 200,
            headers: { "Content-Type": "application/rss+xml" },
          })
      );

    const result = await discoverFeedFromUrl("https://example.com/blog", fetchMock);

    expect(result).toEqual({
      requestedUrl: "https://example.com/blog",
      feedUrl: "https://example.com/feed.xml",
      method: "html_link",
    });
  });

  it("falls back to common root feed paths", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        async () =>
          new Response("<html><head></head><body>No feed link</body></html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          })
      )
      .mockImplementationOnce(async () => new Response("Not found", { status: 404 }))
      .mockImplementationOnce(
        async () =>
          new Response('<?xml version="1.0"?><feed><title>Atom</title></feed>', {
            status: 200,
            headers: { "Content-Type": "application/atom+xml" },
          })
      );

    const result = await discoverFeedFromUrl("https://example.com/posts/123", fetchMock);

    expect(result).toEqual({
      requestedUrl: "https://example.com/posts/123",
      feedUrl: "https://example.com/feed.xml",
      method: "fallback",
    });
  });

  it("throws when no feed can be found", async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response("<html><head></head><body>No feed</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
    );

    await expect(discoverFeedFromUrl("https://example.com", fetchMock)).rejects.toMatchObject({
      code: "feed_not_found",
    });
  });
});
