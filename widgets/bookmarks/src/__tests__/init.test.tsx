// @vitest-environment jsdom

import { DETAIL_RENDERER_REGISTRY } from "@radarboard/widget-sdk/detail-renderer-registry";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { initializeRaindropWidget } from "../init";

describe("initializeRaindropWidget", () => {
  beforeEach(() => {
    DETAIL_RENDERER_REGISTRY.clear();
  });

  it("registers bookmark and collection detail renderers", () => {
    initializeRaindropWidget();

    expect(DETAIL_RENDERER_REGISTRY.has("raindrop.bookmark")).toBe(true);
    expect(DETAIL_RENDERER_REGISTRY.has("raindrop.collection")).toBe(true);
  });

  it("returns react elements from the registered bookmark and collection renderers", () => {
    initializeRaindropWidget();
    const bookmarkRenderer = DETAIL_RENDERER_REGISTRY.get("raindrop.bookmark");
    const collectionRenderer = DETAIL_RENDERER_REGISTRY.get("raindrop.collection");

    if (!bookmarkRenderer || !collectionRenderer) {
      throw new Error("Expected detail renderers to be registered");
    }

    expect(
      isValidElement(
        bookmarkRenderer({
          item: {
            title: "Docs",
            link: "https://example.com",
            raindropUrl: "https://app.raindrop.io/item/1",
            domain: "example.com",
            created: "2026-03-20T00:00:00.000Z",
            tags: [],
          },
        } as never)
      )
    ).toBe(true);
    expect(
      isValidElement(
        collectionRenderer({
          item: { title: "Reading", collectionUrl: "https://app.raindrop.io/my/1", count: 4 },
        } as never)
      )
    ).toBe(true);
  });
});
