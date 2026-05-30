import { describe, expect, it } from "vitest";
import { vercelDeploymentsMcpTools } from "./";

describe("Vercel Deployments MCP Tools", () => {
  it("exports tool definitions with required fields", () => {
    for (const tool of vercelDeploymentsMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
