import { describe, expect, it } from "vitest";
import { openpanelMcpTools } from "./mcp-tools";

describe("Openpanel MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of openpanelMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect("route" in tool || "execute" in tool).toBe(true);
    }
  });
});
