// @vitest-environment jsdom

import { DETAIL_RENDERER_REGISTRY } from "@radarboard/widget-sdk/detail-renderer-registry";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { initializeStarsWidget } from "../init";

describe("initializeStarsWidget", () => {
  beforeEach(() => {
    DETAIL_RENDERER_REGISTRY.clear();
  });

  it("registers the github stars repo detail renderer", () => {
    initializeStarsWidget();

    expect(DETAIL_RENDERER_REGISTRY.has("github.stars-repo")).toBe(true);
  });

  it("returns a react element from the registered stars repo renderer", () => {
    initializeStarsWidget();
    const renderer = DETAIL_RENDERER_REGISTRY.get("github.stars-repo");

    if (!renderer) throw new Error("Expected stars detail renderer");

    expect(
      isValidElement(
        renderer({
          projectSlug: "atlas",
          item: {
            fullName: "openai/codex",
            description: "Agents",
            language: "TypeScript",
            htmlUrl: "https://github.com/openai/codex",
            stars: 100,
            forks: 5,
            openIssues: 1,
            watchers: 9,
            historyPoints: [],
            updatedAt: "2026-03-20T00:00:00.000Z",
            starsDeltaLabel: "+0",
          },
        } as never)
      )
    ).toBe(true);
  });
});
