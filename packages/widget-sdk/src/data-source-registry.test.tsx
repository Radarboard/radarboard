// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  DATA_SOURCE_REGISTRY,
  registerTemplateDataSource,
  reportResolverState,
} from "./data-source-registry";

describe("data source registry", () => {
  it("registers resolvers by id and reports resolver state through the callback", () => {
    const resolver = vi.fn(() => null);
    const onState = vi.fn();

    registerTemplateDataSource("analytics", resolver);
    reportResolverState(onState, {
      data: { visitors: 10 },
      fetchedAt: 123,
      loading: false,
      error: null,
    });

    expect(DATA_SOURCE_REGISTRY.get("analytics")).toBe(resolver);
    expect(onState).toHaveBeenCalledWith({
      data: { visitors: 10 },
      fetchedAt: 123,
      loading: false,
      error: null,
    });
  });
});
