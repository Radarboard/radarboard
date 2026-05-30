import { describe, expect, it } from "vitest";
import { resendMcpTools } from "./mcp-tools";

describe("Resend MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of resendMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect("route" in tool || "execute" in tool).toBe(true);
    }
  });
});
