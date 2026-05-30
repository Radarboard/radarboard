import { describe, expect, it } from "vitest";
import { __PLUGIN_CAMEL__McpTools } from "./mcp-tools";

describe("__PLUGIN_NAME__ MCP Tools", () => {
  it("exports an array of tool definitions", () => {
    expect(Array.isArray(__PLUGIN_CAMEL__McpTools)).toBe(true);
  });
});
