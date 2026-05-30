import { describe, expect, it } from "vitest";
import { npmDownloadsMcpTools } from "./";

describe("npm Downloads MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of npmDownloadsMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
