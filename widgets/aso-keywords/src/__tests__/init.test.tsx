import { DETAIL_RENDERER_REGISTRY } from "@radarboard/widget-sdk/detail-renderer-registry";
import { beforeEach, describe, expect, it } from "vitest";
import { initializeAsoKeywordsWidget } from "../init";

describe("initializeAsoKeywordsWidget", () => {
  beforeEach(() => {
    DETAIL_RENDERER_REGISTRY.clear();
  });

  it("registers the ASO keyword detail renderer", () => {
    initializeAsoKeywordsWidget();

    expect(DETAIL_RENDERER_REGISTRY.has("aso.keyword")).toBe(true);
  });
});
