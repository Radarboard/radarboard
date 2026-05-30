import type { SettingsRepository } from "@radarboard/types/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repository", () => ({
  getSettingsRepo: vi.fn(),
}));

vi.mock("@/lib/event-gateway", () => ({
  emitCacheInvalidation: vi.fn(),
}));

vi.mock("@/lib/workflow-scheduler-runtime", () => ({
  ensureWorkflowSchedulerStarted: vi.fn().mockResolvedValue(undefined),
}));

type SchemaLike = {
  safeParse: (value: unknown) => {
    success: boolean;
    data?: unknown;
    error?: { issues?: Array<{ path: (string | number)[]; message: string }> };
  };
};

vi.mock("@/lib/api", () => ({
  parseBody: async (request: Request, schema: SchemaLike) => {
    const payload = await request.json();
    const result = schema.safeParse(payload);
    if (result.success) return { ok: true as const, data: result.data };
    const issues = result.error?.issues ?? [];
    return {
      ok: false as const,
      response: new Response(
        JSON.stringify({
          error: issues[0]?.message ?? "Invalid request",
          issues: issues.map((e) => ({ path: e.path, message: e.message })),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ),
    };
  },
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { getSettingsRepo } from "@/db/repository";
import { emitCacheInvalidation } from "@/lib/event-gateway";
import { handleGetSettings, handleUpdateSettings } from "../routes";

const mockRepo: Record<string, ReturnType<typeof vi.fn>> = {
  getProjectOrder: vi.fn().mockResolvedValue([]),
  setProjectOrder: vi.fn().mockResolvedValue(undefined),
  getWidgetLayout: vi.fn().mockResolvedValue(null),
  setWidgetLayout: vi.fn().mockResolvedValue(undefined),
  getProjectIntegrations: vi.fn().mockResolvedValue({}),
  setProjectIntegrations: vi.fn().mockResolvedValue(undefined),
  getIntegrationConnections: vi.fn().mockResolvedValue([]),
  setIntegrationConnections: vi.fn().mockResolvedValue(undefined),
  getProjectContextMap: vi.fn().mockResolvedValue({}),
  setProjectContextMap: vi.fn().mockResolvedValue(undefined),
  getLlmConfig: vi.fn().mockResolvedValue({}),
  setLlmConfig: vi.fn().mockResolvedValue(undefined),
  getDebugConfig: vi.fn().mockResolvedValue({}),
  setDebugConfig: vi.fn().mockResolvedValue(undefined),
  getRoutingConfig: vi.fn().mockResolvedValue({ rules: [] }),
  setRoutingConfig: vi.fn().mockResolvedValue(undefined),
  getFeaturePreferences: vi.fn().mockResolvedValue({}),
  setFeaturePreferences: vi.fn().mockResolvedValue(undefined),
  getUserPlan: vi.fn().mockResolvedValue("free"),
};

beforeEach(() => {
  for (const fn of Object.values(mockRepo)) fn.mockClear();
  vi.mocked(getSettingsRepo).mockReturnValue(mockRepo as unknown as SettingsRepository);
  vi.mocked(emitCacheInvalidation).mockClear();
});

function makePost(payload: unknown): Request {
  return new Request("http://localhost/api/system/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("handleGetSettings", () => {
  it("returns all settings in parallel", async () => {
    mockRepo.getProjectOrder.mockResolvedValue(["project-a"]);
    mockRepo.getUserPlan.mockResolvedValue("pro");

    const res = await handleGetSettings();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.projectOrder).toEqual(["project-a"]);
    expect(body.userPlan).toBe("pro");
    expect(body.widgetLayout).toBeNull();
    expect(body.projectIntegrations).toEqual({});
  });

  it("gracefully handles individual setting failures", async () => {
    mockRepo.getProjectOrder.mockResolvedValue(["a"]);
    mockRepo.getProjectIntegrations.mockRejectedValue(new Error("db error"));
    mockRepo.getLlmConfig.mockRejectedValue(new Error("db error"));

    const res = await handleGetSettings();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.projectOrder).toEqual(["a"]);
    // Fallback values from .catch()
    expect(body.projectIntegrations).toEqual({});
    expect(body.llmConfig).toEqual({});
  });

  it("gracefully handles core settings failures with defaults", async () => {
    mockRepo.getProjectOrder.mockRejectedValue(new Error("DB down"));
    mockRepo.getWidgetLayout.mockRejectedValue(new Error("DB down"));

    const res = await handleGetSettings();
    const body = await res.json();

    // Core settings now fall back to defaults instead of returning 500
    expect(res.status).toBe(200);
    expect(body.projectOrder).toEqual([]);
    expect(body.widgetLayout).toBeNull();
  });
});

describe("handleUpdateSettings", () => {
  it("updates projectOrder only", async () => {
    const res = await handleUpdateSettings(makePost({ projectOrder: ["b", "a"] }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRepo.setProjectOrder).toHaveBeenCalledWith(["b", "a"]);
    expect(mockRepo.setWidgetLayout).not.toHaveBeenCalled();
  });

  it("rejects empty body with no settings to update", async () => {
    const res = await handleUpdateSettings(makePost({}));
    expect(res.status).toBe(400);
  });

  it("emits cache invalidation when projectIntegrations are updated", async () => {
    const res = await handleUpdateSettings(
      makePost({ projectIntegrations: { project: { github: { enabled: true } } } })
    );

    expect(res.status).toBe(200);
    expect(mockRepo.setProjectIntegrations).toHaveBeenCalled();
    expect(emitCacheInvalidation).toHaveBeenCalledWith(
      expect.arrayContaining(["/api/integrations/"]),
      "settings:projectIntegrations"
    );
  });

  it("updates widgetLayout with preferences", async () => {
    const res = await handleUpdateSettings(
      makePost({
        widgetLayout: {
          configs: {},
          appearance: { fontScale: "md" },
        },
      })
    );

    expect(res.status).toBe(200);
    expect(mockRepo.setWidgetLayout).toHaveBeenCalled();
  });

  it("updates llmConfig", async () => {
    const llmConfig = {
      identityPrompt: "You are a helpful assistant",
      assistantPresets: [{ id: "p1", name: "Quick", prompt: "Be concise", mode: "default" }],
    };

    const res = await handleUpdateSettings(makePost({ llmConfig }));
    expect(res.status).toBe(200);
    expect(mockRepo.setLlmConfig).toHaveBeenCalledWith(llmConfig);
  });

  it("updates debugConfig", async () => {
    const debugConfig = { promotionEnabled: true, retentionDays: 30 };

    const res = await handleUpdateSettings(makePost({ debugConfig }));
    expect(res.status).toBe(200);
    expect(mockRepo.setDebugConfig).toHaveBeenCalledWith(debugConfig);
  });

  it("normalizes routing rules with null defaults", async () => {
    const routingConfig = {
      rules: [
        {
          id: "r1",
          name: "Test rule",
          enabled: true,
          notifications: "allow" as const,
          ticker: "inherit" as const,
          createdAt: 1700000000,
          updatedAt: 1700000000,
        },
      ],
    };

    const res = await handleUpdateSettings(makePost({ routingConfig }));
    expect(res.status).toBe(200);

    const savedConfig = mockRepo.setRoutingConfig.mock.calls[0][0];
    expect(savedConfig.rules[0].source).toBeNull();
    expect(savedConfig.rules[0].eventType).toBeNull();
    expect(savedConfig.rules[0].severity).toBeNull();
    expect(savedConfig.rules[0].condition).toBeNull();
  });

  it("returns 500 on repo error", async () => {
    mockRepo.setProjectOrder.mockRejectedValue(new Error("Write failed"));

    const res = await handleUpdateSettings(makePost({ projectOrder: ["a"] }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("Failed to save settings");
  });
});
