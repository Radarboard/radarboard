// @vitest-environment jsdom

import { DETAIL_RENDERER_REGISTRY } from "@radarboard/widget-sdk/detail-renderer-registry";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { initializeShippingWidget } from "../init";

describe("initializeShippingWidget", () => {
  beforeEach(() => {
    DETAIL_RENDERER_REGISTRY.clear();
  });

  it("registers the shipping item detail renderer", () => {
    initializeShippingWidget();

    expect(DETAIL_RENDERER_REGISTRY.has("shipping.item")).toBe(true);
  });

  it("returns a react element from the registered shipping renderer", () => {
    initializeShippingWidget();
    const renderer = DETAIL_RENDERER_REGISTRY.get("shipping.item");

    if (!renderer) throw new Error("Expected shipping detail renderer");

    expect(
      isValidElement(
        renderer({
          item: {
            title: "Fix sync",
            source: "linear",
            projectName: "Radarboard",
            timeAgo: "1h ago",
          },
        } as never)
      )
    ).toBe(true);
  });
});
