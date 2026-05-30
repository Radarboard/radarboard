import { describe, expect, it } from "vitest";
import { revenueMcpTools } from "./";

describe("Revenue MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of revenueMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
