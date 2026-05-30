import { describe, expect, it } from "vitest";
import { vercelDomainsMcpTools } from "./";

describe("Vercel Domains MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of vercelDomainsMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
