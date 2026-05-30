import { describe, expect, it } from "vitest";
import { openCollectiveMcpTools } from "./mcp-tools";

describe("Open Collective MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of openCollectiveMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect("route" in tool || "execute" in tool).toBe(true);
    }
  });
});
