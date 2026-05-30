import { describe, expect, it } from "vitest";
import { vercelBuildPerfMcpTools } from "./";

describe("Vercel Build Performance MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of vercelBuildPerfMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
