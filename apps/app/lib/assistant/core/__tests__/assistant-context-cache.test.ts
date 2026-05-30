import { afterEach, describe, expect, it } from "vitest";
import {
  getCachedAssistantContext,
  invalidateAssistantContextCache,
  setCachedAssistantContext,
} from "../assistant-context-cache";

afterEach(() => {
  invalidateAssistantContextCache();
});

const MOCK_CONTEXT = {
  aiTools: { get_revenue: {} },
  actionTools: { create_linear_issue: {} },
  mcpTools: {},
  pluginTools: {},
  pluginToolNames: [],
  browserToolsAvailable: false,
};

describe("assistant context cache", () => {
  it("returns null when empty", () => {
    expect(getCachedAssistantContext(["linear"])).toBeNull();
  });

  it("caches and retrieves context", () => {
    setCachedAssistantContext(["linear", "github"], MOCK_CONTEXT);
    const cached = getCachedAssistantContext(["linear", "github"]);
    expect(cached).not.toBeNull();
    expect(cached?.aiTools).toEqual({ get_revenue: {} });
  });

  it("invalidates when credential keys change", () => {
    setCachedAssistantContext(["linear"], MOCK_CONTEXT);
    expect(getCachedAssistantContext(["linear", "github"])).toBeNull();
  });

  it("matches regardless of key order", () => {
    setCachedAssistantContext(["github", "linear"], MOCK_CONTEXT);
    expect(getCachedAssistantContext(["linear", "github"])).not.toBeNull();
  });

  it("invalidates on manual invalidation", () => {
    setCachedAssistantContext(["linear"], MOCK_CONTEXT);
    invalidateAssistantContextCache();
    expect(getCachedAssistantContext(["linear"])).toBeNull();
  });
});
