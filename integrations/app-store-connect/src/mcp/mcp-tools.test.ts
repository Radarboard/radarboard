import { describe, expect, it } from "vitest";
import { appStoreConnectMcpTools } from "./mcp-tools";

describe("App Store Connect MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of appStoreConnectMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect("route" in tool || "execute" in tool).toBe(true);
    }
  });
});
