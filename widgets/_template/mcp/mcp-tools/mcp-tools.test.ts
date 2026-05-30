import { describe, expect, it } from "vitest";
import { __WIDGET_CAMEL__McpTools } from "./";

describe("__WIDGET_NAME__ MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of __WIDGET_CAMEL__McpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
