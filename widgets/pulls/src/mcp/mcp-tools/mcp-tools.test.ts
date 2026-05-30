import { describe, expect, it } from "vitest";
import { githubActivityMcpTools } from "./";

describe("GitHub Activity MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of githubActivityMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
