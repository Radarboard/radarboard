import { describe, expect, it } from "vitest";
import { sponsorshipMcpTools } from "./";

describe("Sponsorship MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of sponsorshipMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
