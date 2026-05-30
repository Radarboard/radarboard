import { describe, expect, it } from "vitest";
import { shippingMcpTools } from "./";

describe("Shipping MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of shippingMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
