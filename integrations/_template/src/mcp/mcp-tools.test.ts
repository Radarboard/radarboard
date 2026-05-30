import { describe, expect, it } from "vitest";
import { __INTEGRATION_CAMEL__McpTools } from "./mcp-tools";

describe("__INTEGRATION_NAME__ MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of __INTEGRATION_CAMEL__McpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect("route" in tool || "execute" in tool).toBe(true);
    }
  });
});
