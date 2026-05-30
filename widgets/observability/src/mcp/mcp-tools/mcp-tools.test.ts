import { describe, expect, it } from "vitest";
import { detailMcpTools } from "./";

describe("Detail MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of detailMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
