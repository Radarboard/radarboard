import { describe, expect, it } from "vitest";
import { betterstackMcpTools } from "./mcp-tools";

describe("Betterstack MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of betterstackMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect("route" in tool || "execute" in tool).toBe(true);
    }
  });
});
