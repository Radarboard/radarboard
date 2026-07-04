import { beforeEach, describe, expect, it, vi } from "vitest";

const executeFindOptions = vi.fn();
const executePlanSetup = vi.fn();
const executeCreateIntegration = vi.fn();
const executeConnectMcp = vi.fn();
const executePlaceRestWidget = vi.fn();
const executeListUserIntegrations = vi.fn();
const executeRemoveIntegration = vi.fn();

vi.mock("@/lib/debug-events", () => ({ emitDebugEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/extensions/runtime/integrations-init", () => ({}));
vi.mock("@/lib/ai-actions/integrations/find-options", () => ({
  executeFindOptions: (a: unknown) => executeFindOptions(a),
}));
vi.mock("@/lib/ai-actions/integrations/plan-setup", () => ({
  executePlanSetup: (a: unknown) => executePlanSetup(a),
}));
vi.mock("@/lib/ai-actions/integrations/connect-mcp", () => ({
  executeConnectMcp: (a: unknown) => executeConnectMcp(a),
}));
vi.mock("@/lib/ai-actions/integrations/place-rest-widget", () => ({
  executePlaceRestWidget: (a: unknown) => executePlaceRestWidget(a),
}));
vi.mock("@/lib/ai-actions/dashboard/connect-integration", () => ({
  executeCreateIntegration: (a: unknown) => executeCreateIntegration(a),
  executeListUserIntegrations: () => executeListUserIntegrations(),
  executeRemoveIntegration: (a: unknown) => executeRemoveIntegration(a),
}));

import { runTool } from "@/app/api/mcp/tools";

function parsed(result: { content: [{ type: "text"; text: string }] }) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MCP ladder tools dispatch → executors", () => {
  it("find_integration_options → executeFindOptions", async () => {
    executeFindOptions.mockResolvedValue({
      service: "stripe",
      options: [],
      recommendedRung: "rest",
    });
    const res = await runTool("find_integration_options", { service: "stripe" });
    expect(executeFindOptions).toHaveBeenCalledWith({ service: "stripe" });
    expect(parsed(res)).toMatchObject({ service: "stripe", recommendedRung: "rest" });
  });

  it("plan_integration_setup → executePlanSetup", async () => {
    executePlanSetup.mockResolvedValue({ service: "sentry", recommendedRung: "mcp" });
    const res = await runTool("plan_integration_setup", { service: "sentry" });
    expect(executePlanSetup).toHaveBeenCalledWith({ service: "sentry" });
    expect(parsed(res)).toMatchObject({ recommendedRung: "mcp" });
  });

  it("create_rest_integration → executeCreateIntegration", async () => {
    executeCreateIntegration.mockResolvedValue({ created: true, id: "acme" });
    const args = { id: "acme", name: "Acme", baseUrl: "https://api.acme.test" };
    const res = await runTool("create_rest_integration", args);
    expect(executeCreateIntegration).toHaveBeenCalledWith(args);
    expect(parsed(res)).toMatchObject({ created: true, id: "acme" });
  });

  it("connect_mcp_server → executeConnectMcp", async () => {
    executeConnectMcp.mockResolvedValue({ connected: true, name: "sentry" });
    const res = await runTool("connect_mcp_server", { name: "sentry", url: "https://x/mcp" });
    expect(executeConnectMcp).toHaveBeenCalledWith({ name: "sentry", url: "https://x/mcp" });
    expect(parsed(res)).toMatchObject({ connected: true });
  });

  it("show_rest_data → executePlaceRestWidget", async () => {
    executePlaceRestWidget.mockResolvedValue({ placed: true, widgetId: "rest-acme" });
    const res = await runTool("show_rest_data", { integrationId: "acme" });
    expect(executePlaceRestWidget).toHaveBeenCalledWith({ integrationId: "acme" });
    expect(parsed(res)).toMatchObject({ placed: true, widgetId: "rest-acme" });
  });

  it("list_user_integrations → executeListUserIntegrations", async () => {
    executeListUserIntegrations.mockResolvedValue({
      integrations: [{ id: "acme", name: "Acme", category: "analytics" }],
    });
    const res = await runTool("list_user_integrations", {});
    expect(executeListUserIntegrations).toHaveBeenCalled();
    expect(parsed(res)).toMatchObject({ integrations: [{ id: "acme" }] });
  });

  it("remove_rest_integration → executeRemoveIntegration", async () => {
    executeRemoveIntegration.mockResolvedValue({ removed: true, id: "acme" });
    const res = await runTool("remove_rest_integration", { id: "acme" });
    expect(executeRemoveIntegration).toHaveBeenCalledWith({ id: "acme" });
    expect(parsed(res)).toMatchObject({ removed: true, id: "acme" });
  });
});
