import { describe, expect, it } from "vitest";
import { logsMcpTools } from "./";

describe("Logs MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of logsMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
