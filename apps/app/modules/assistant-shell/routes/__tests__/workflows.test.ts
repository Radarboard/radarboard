import { beforeEach, describe, expect, it, vi } from "vitest";

const listWorkflowsRouteMock = vi.fn();
const createWorkflowRouteMock = vi.fn();
const deleteWorkflowRouteMock = vi.fn();

vi.mock("@radarboard/feature-workflows/server/routes", () => ({
  listWorkflowsRoute: (...args: unknown[]) => listWorkflowsRouteMock(...args),
  createWorkflowRoute: (...args: unknown[]) => createWorkflowRouteMock(...args),
  deleteWorkflowRoute: (...args: unknown[]) => deleteWorkflowRouteMock(...args),
}));

import {
  handleDeleteWorkflow as DELETE,
  handleListWorkflows as GET,
  handleCreateWorkflow as POST,
} from "@/modules/assistant-shell/routes/workflows";

beforeEach(() => {
  listWorkflowsRouteMock.mockReset();
  createWorkflowRouteMock.mockReset();
  deleteWorkflowRouteMock.mockReset();
});

describe("GET /api/assistant/workflows", () => {
  it("returns list of workflows", async () => {
    const workflows = [
      { id: "wf1", name: "Deploy notifier", steps: [] },
      { id: "wf2", name: "Daily briefing", steps: [] },
    ];
    listWorkflowsRouteMock.mockResolvedValue(workflows);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(workflows);
  });

  it("returns empty array when no workflows exist", async () => {
    listWorkflowsRouteMock.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual([]);
  });
});

describe("POST /api/assistant/workflows", () => {
  function makeRequest(payload: unknown): Request {
    return new Request("http://localhost/api/assistant/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  it("creates a new workflow and returns 201", async () => {
    const created = { id: "wf3", name: "New workflow" };
    createWorkflowRouteMock.mockResolvedValue(created);

    const res = await POST(
      makeRequest({
        name: "New workflow",
        description: "Does stuff",
        trigger: { type: "schedule", cron: "0 9 * * *" },
        steps: [{ action: "notify", config: {} }],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("wf3");
    expect(createWorkflowRouteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New workflow",
        description: "Does stuff",
      })
    );
  });

  it("passes empty description when not provided", async () => {
    createWorkflowRouteMock.mockResolvedValue({ id: "wf4" });

    await POST(
      makeRequest({
        name: "Minimal",
        trigger: { type: "manual" },
        steps: [],
      })
    );

    expect(createWorkflowRouteMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: "" })
    );
  });
});

describe("DELETE /api/assistant/workflows", () => {
  it("deletes a workflow by id", async () => {
    deleteWorkflowRouteMock.mockResolvedValue({ deleted: true });

    const req = new Request("http://localhost/api/assistant/workflows?id=wf1", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    const body = await res.json();

    expect(body.deleted).toBe(true);
    expect(deleteWorkflowRouteMock).toHaveBeenCalledWith("wf1");
  });

  it("returns 400 when id is missing", async () => {
    const req = new Request("http://localhost/api/assistant/workflows", { method: "DELETE" });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("id required");
  });
});
