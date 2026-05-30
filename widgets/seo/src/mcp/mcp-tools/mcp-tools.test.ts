import { describe, expect, it } from "vitest";
import { seoMcpTools } from "./";

describe("SEO MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of seoMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
