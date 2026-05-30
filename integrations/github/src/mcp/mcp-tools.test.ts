import { describe, expect, it } from "vitest";
import { githubMcpTools } from "./mcp-tools";

describe("Github MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of githubMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect("route" in tool || "execute" in tool).toBe(true);
    }
  });
});
