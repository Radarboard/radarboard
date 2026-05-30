import { describe, expect, it } from "vitest";
import { linearMcpTools } from "./mcp-tools";

describe("Linear MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of linearMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect("route" in tool || "execute" in tool).toBe(true);
    }
  });
});
