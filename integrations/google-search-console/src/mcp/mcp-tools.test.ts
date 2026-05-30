import { describe, expect, it } from "vitest";
import { googleSearchConsoleMcpTools } from "./mcp-tools";

describe("Google Search Console MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of googleSearchConsoleMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect("route" in tool || "execute" in tool).toBe(true);
    }
  });
});
