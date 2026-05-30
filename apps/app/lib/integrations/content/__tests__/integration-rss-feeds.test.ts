import { describe, expect, it } from "vitest";
import { getIntegrationRssFeedMode, resolveIntegrationRssFeedUrl } from "../integration-rss-feeds";

describe("integration-rss-feeds", () => {
  it("falls back to the suggested default when there is no override", () => {
    expect(resolveIntegrationRssFeedUrl("github", {}, "https://example.com/feed.xml")).toBe(
      "https://example.com/feed.xml"
    );
    expect(getIntegrationRssFeedMode("github", {})).toBe("inherit");
  });

  it("uses a custom override when present", () => {
    expect(
      resolveIntegrationRssFeedUrl(
        "github",
        { github: "https://status.example.com/rss.xml" },
        "https://example.com/feed.xml"
      )
    ).toBe("https://status.example.com/rss.xml");
    expect(
      getIntegrationRssFeedMode("github", { github: "https://status.example.com/rss.xml" })
    ).toBe("custom");
  });

  it("allows a suggested default to be explicitly disabled", () => {
    expect(
      resolveIntegrationRssFeedUrl("github", { github: null }, "https://example.com/feed.xml")
    ).toBeNull();
    expect(getIntegrationRssFeedMode("github", { github: null })).toBe("disabled");
  });
});
