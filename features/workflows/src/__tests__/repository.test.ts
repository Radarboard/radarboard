import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initWorkflowContext } from "../context";
import {
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  listWorkflows,
} from "../repository";
import type { Workflow } from "../types";

// Mock workflow store
let mockWorkflowStore: Record<string, Workflow> = {};

// Initialize context with mock implementations
beforeEach(() => {
  mockWorkflowStore = {};
  initWorkflowContext({
    getWorkflows: vi.fn(async () => ({ ...mockWorkflowStore })),
    setWorkflows: vi.fn(async (workflows: Record<string, Workflow>) => {
      mockWorkflowStore = { ...workflows };
    }),
    getCredentialRepo: () => ({
      getCredential: vi.fn(async () => null),
      setCredential: vi.fn(async () => {}),
      deleteCredential: vi.fn(async () => {}),
      listCredentialKeys: vi.fn(async () => []),
    }),
    buildDataSourceContext: () => ({} as any),
    emitNotification: vi.fn(),
    emitDebugEvent: vi.fn(),
  });
});

afterEach(() => {
  mockWorkflowStore = {};
});

describe("workflow CRUD", () => {
  it("creates a workflow", async () => {
    const workflow = await createWorkflow(
      "Alert on downtime",
      "Notify when uptime drops",
      { type: "threshold", dataSource: "betterstack/data", metricPath: "uptime", operator: "lt", value: 99 },
      [{ type: "notify", channel: "sse", title: "Downtime alert", body: "Uptime dropped below 99%" }]
    );

    expect(workflow.id).toBeDefined();
    expect(workflow.name).toBe("Alert on downtime");
    expect(workflow.enabled).toBe(true);
  });

  it("lists workflows", async () => {
    await createWorkflow("W1", "desc1", { type: "schedule", cron: "0 8 * * *" }, []);
    await createWorkflow("W2", "desc2", { type: "schedule", cron: "0 9 * * *" }, []);

    const list = await listWorkflows();
    expect(list).toHaveLength(2);
  });

  it("gets a workflow by id", async () => {
    const created = await createWorkflow("W1", "desc", { type: "schedule", cron: "0 8 * * *" }, []);
    const found = await getWorkflow(created.id);
    expect(found?.name).toBe("W1");
  });

  it("deletes a workflow", async () => {
    const created = await createWorkflow("W1", "desc", { type: "schedule", cron: "0 8 * * *" }, []);
    expect(await deleteWorkflow(created.id)).toBe(true);
    expect(await listWorkflows()).toHaveLength(0);
  });

  it("returns false when deleting non-existent workflow", async () => {
    expect(await deleteWorkflow("non-existent")).toBe(false);
  });
});
