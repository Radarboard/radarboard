import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationOption } from "../find-options";

const executeFindOptions = vi.fn();

vi.mock("../find-options", () => ({
  executeFindOptions: (args: unknown) => executeFindOptions(args),
}));

import { executePlanSetup } from "../plan-setup";

function discovery(recommendedRung: string, options: IntegrationOption[]) {
  return { service: "svc", options, recommendedRung };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executePlanSetup", () => {
  it("proposes connect_integration for an unconnected api-key integration", async () => {
    executeFindOptions.mockResolvedValue(
      discovery("registered", [
        {
          rung: "registered",
          id: "acme",
          name: "Acme",
          description: "",
          authType: "api_key",
          connected: false,
        },
      ])
    );
    const res = await executePlanSetup({ service: "acme" });
    expect(res.recommendedRung).toBe("registered");
    expect(res.actionSpec).toMatchObject({
      tool: "connect_integration",
      params: { integrationId: "acme" },
      userMustProvide: ["credentials"],
    });
  });

  it("says a connected integration is ready and proposes no executor", async () => {
    executeFindOptions.mockResolvedValue(
      discovery("registered", [
        {
          rung: "registered",
          id: "acme",
          name: "Acme",
          description: "",
          authType: "api_key",
          connected: true,
        },
      ])
    );
    const res = await executePlanSetup({ service: "acme" });
    expect(res.actionSpec.tool).toBeNull();
    expect(res.proposal).toMatch(/already connected/i);
  });

  it("routes OAuth integrations to Settings, not an executor", async () => {
    executeFindOptions.mockResolvedValue(
      discovery("registered", [
        {
          rung: "registered",
          id: "gh",
          name: "GitHub",
          description: "",
          authType: "oauth",
          connected: false,
        },
      ])
    );
    const res = await executePlanSetup({ service: "github" });
    expect(res.actionSpec.tool).toBeNull();
    expect(res.proposal).toMatch(/OAuth/);
  });

  it("proposes connect_mcp_server and asks for url+token when unknown", async () => {
    executeFindOptions.mockResolvedValue(
      discovery("mcp", [
        {
          rung: "mcp",
          service: "sentry",
          name: "Sentry",
          description: "",
          requiresAuth: true,
          authHint: "a Sentry auth token",
          docsUrl: "https://docs.sentry.io",
        },
      ])
    );
    const res = await executePlanSetup({ service: "sentry" });
    expect(res.actionSpec).toMatchObject({
      tool: "connect_mcp_server",
      params: { name: "sentry", docsUrl: "https://docs.sentry.io" },
    });
    expect(res.actionSpec.userMustProvide).toEqual(["url", "token"]);
  });

  it("does not ask for a url when the MCP entry already has one", async () => {
    executeFindOptions.mockResolvedValue(
      discovery("mcp", [
        {
          rung: "mcp",
          service: "local",
          name: "Local",
          description: "",
          url: "https://mcp.local/mcp",
          requiresAuth: false,
        },
      ])
    );
    const res = await executePlanSetup({ service: "local" });
    expect(res.actionSpec.params).toMatchObject({ url: "https://mcp.local/mcp" });
    expect(res.actionSpec.userMustProvide).toEqual([]);
  });

  it("explains community install is Settings-only (no executor)", async () => {
    executeFindOptions.mockResolvedValue(
      discovery("community", [
        {
          rung: "community",
          id: "acme-pro",
          name: "Acme Pro",
          description: "",
          repoUrl: "https://github.com/x/acme-pro",
        },
      ])
    );
    const res = await executePlanSetup({ service: "acme" });
    expect(res.actionSpec.tool).toBeNull();
    expect(res.proposal).toMatch(/Settings/);
  });

  it("falls back to create_rest_integration when only the rest rung matches", async () => {
    executeFindOptions.mockResolvedValue(discovery("rest", [{ rung: "rest", hint: "..." }]));
    const res = await executePlanSetup({ service: "obscure" });
    expect(res.actionSpec).toMatchObject({
      tool: "create_rest_integration",
      userMustProvide: ["baseUrl", "auth", "dataSources"],
    });
  });

  it("lists the other matched rungs as alternatives", async () => {
    executeFindOptions.mockResolvedValue(
      discovery("registered", [
        {
          rung: "registered",
          id: "acme",
          name: "Acme",
          description: "",
          authType: "api_key",
          connected: false,
        },
        { rung: "mcp", service: "acme", name: "Acme MCP", description: "", requiresAuth: true },
        { rung: "rest", hint: "..." },
      ])
    );
    const res = await executePlanSetup({ service: "acme" });
    expect(res.alternatives).toEqual(["mcp", "rest"]);
  });
});
