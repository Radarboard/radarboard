import { describe, expect, it } from "vitest";
import { githubStarsMcpTools } from "./";

describe("GitHub Stars MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of githubStarsMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
