import { describe, expect, it } from "vitest";
import { revenuecatMcpTools } from "./mcp-tools";

describe("Revenuecat MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of revenuecatMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect("route" in tool || "execute" in tool).toBe(true);
    }
  });
});
