import { describe, expect, it } from "vitest";
import { vercelProjectsMcpTools } from "./";

describe("Vercel Projects MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of vercelProjectsMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
