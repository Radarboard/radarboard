import { DETAIL_RENDERER_REGISTRY } from "@radarboard/widget-sdk/detail-renderer-registry";
import { beforeEach, describe, expect, it } from "vitest";
import { initializeAnalyticsWidget } from "../init";

describe("initializeAnalyticsWidget", () => {
  beforeEach(() => {
    DETAIL_RENDERER_REGISTRY.clear();
  });

  it("registers the analytics top-page detail renderer", () => {
    initializeAnalyticsWidget();

    expect(DETAIL_RENDERER_REGISTRY.has("analytics.top-page")).toBe(true);
  });
});
