import { describe, expect, it } from "vitest";
import { asoKeywordsMcpTools } from "./";

describe("ASO Keywords MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of asoKeywordsMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
