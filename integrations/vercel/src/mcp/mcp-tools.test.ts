import { describe, expect, it } from "vitest";
import { vercelMcpTools } from "./mcp-tools";

describe("Vercel MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of vercelMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect("route" in tool || "execute" in tool).toBe(true);
    }
  });
});
