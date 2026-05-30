// @vitest-environment jsdom

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DETAIL_RENDERER_REGISTRY,
  registerTemplateDetailRenderer,
} from "./detail-renderer-registry";

function DetailRenderer({ item }: { item: ReactNode }) {
  return <div>{item}</div>;
}

describe("detail renderer registry", () => {
  beforeEach(() => {
    DETAIL_RENDERER_REGISTRY.clear();
  });

  it("registers detail renderers by id", () => {
    registerTemplateDetailRenderer("analytics.top-page", DetailRenderer);

    expect(DETAIL_RENDERER_REGISTRY.get("analytics.top-page")).toBe(DetailRenderer);
  });
});
