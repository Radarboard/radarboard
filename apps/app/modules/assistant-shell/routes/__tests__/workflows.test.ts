import { beforeEach, describe, expect, it, vi } from "vitest";

const getFeatureServerRouteMock = vi.fn();
const listRouteMock = vi.fn();
const createRouteMock = vi.fn();
const deleteRouteMock = vi.fn();

vi.mock("@/lib/extensions/runtime/server/feature-server", () => ({
  getFeatureServerRoute: (...args: unknown[]) => getFeatureServerRouteMock(...args),
}));

import {
  handleDeleteWorkflow as DELETE,
  handleListWorkflows as GET,
  handleCreateWorkflow as POST,
} from "@/modules/assistant-shell/routes/workflows";

beforeEach(() => {
  getFeatureServerRouteMock.mockReset();
  listRouteMock.mockReset();
  createRouteMock.mockReset();
  deleteRouteMock.mockReset();
  getFeatureServerRouteMock.mockImplementation((_featureId: string, routeId: string) => {
    if (routeId === "list") return listRouteMock;
    if (routeId === "create") return createRouteMock;
    if (routeId === "delete") return deleteRouteMock;
    return null;
  });
});

describe("GET /api/assistant/workflows", () => {
  it("returns list of workflows", async () => {
    const workflows = [
      { id: "wf1", name: "Deploy notifier", steps: [] },
      { id: "wf2", name: "Daily briefing", steps: [] },
    ];
    listRouteMock.mockResolvedValue({ status: 200, payload: workflows });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(workflows);
  });

  it("returns empty array when no workflows exist", async () => {
    listRouteMock.mockResolvedValue({ status: 200, payload: [] });

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
    createRouteMock.mockResolvedValue({ status: 201, payload: created });

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
    expect(createRouteMock).toHaveBeenCalledWith({
      request: expect.any(Request),
      body: expect.objectContaining({ name: "New workflow", description: "Does stuff" }),
    });
  });

  it("passes empty description when not provided", async () => {
    createRouteMock.mockResolvedValue({ status: 201, payload: { id: "wf4" } });

    await POST(
      makeRequest({
        name: "Minimal",
        trigger: { type: "manual" },
        steps: [],
      })
    );

    expect(createRouteMock).toHaveBeenCalledWith({
      request: expect.any(Request),
      body: expect.not.objectContaining({ description: expect.anything() }),
    });
  });
});

describe("DELETE /api/assistant/workflows", () => {
  it("deletes a workflow by id", async () => {
    deleteRouteMock.mockResolvedValue({ status: 200, payload: { deleted: true } });

    const req = new Request("http://localhost/api/assistant/workflows?id=wf1", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    const body = await res.json();

    expect(body.deleted).toBe(true);
    expect(deleteRouteMock).toHaveBeenCalledWith({
      request: expect.any(Request),
      body: { id: "wf1" },
    });
  });

  it("returns 400 when id is missing", async () => {
    const req = new Request("http://localhost/api/assistant/workflows", { method: "DELETE" });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("id required");
  });
});
