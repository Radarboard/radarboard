import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extensions/runtime/integrations-init", () => ({}));
vi.mock("@/app/api/mcp/tools", () => ({ runTool: vi.fn().mockResolvedValue(undefined) }));

import { registerLadderTools } from "../server";

describe("registerLadderTools", () => {
  it("registers all ladder tools with a description, a shape, and a handler", () => {
    const tool = vi.fn();
    registerLadderTools({ tool } as unknown as Parameters<typeof registerLadderTools>[0]);

    const names = tool.mock.calls.map((c) => c[0]);
    expect(names).toEqual([
      "find_integration_options",
      "plan_integration_setup",
      "create_rest_integration",
      "connect_mcp_server",
      "show_rest_data",
      "list_user_integrations",
      "remove_rest_integration",
    ]);

    for (const [name, description, shape, handler] of tool.mock.calls) {
      expect(typeof name).toBe("string");
      expect(typeof description).toBe("string");
      expect(description.length).toBeGreaterThan(10);
      expect(shape && typeof shape).toBe("object");
      expect(typeof handler).toBe("function");
    }
  });

  it("handlers delegate to runTool with the tool name", async () => {
    const { runTool } = await import("@/app/api/mcp/tools");
    const tool = vi.fn();
    registerLadderTools({ tool } as unknown as Parameters<typeof registerLadderTools>[0]);

    const createCall = tool.mock.calls.find((c) => c[0] === "create_rest_integration");
    const handler = createCall?.[3] as (args: unknown) => Promise<unknown>;
    await handler({ id: "acme" });
    expect(runTool).toHaveBeenCalledWith("create_rest_integration", { id: "acme" });
  });
});
