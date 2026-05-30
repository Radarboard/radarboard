import { beforeEach, describe, expect, it, vi } from "vitest";

const buildKnowledgeHealthItemDetailMock = vi.fn();
const isFeatureEnabledMock = vi.fn();
const featureNotFoundMock = vi.fn();
const getLlmRepoMock = vi.fn();

vi.mock("@/db/repository", () => ({
  getLlmRepo: () => getLlmRepoMock(),
}));

vi.mock("@/lib/features", () => ({
  isFeatureEnabled: () => isFeatureEnabledMock(),
  featureNotFound: () => featureNotFoundMock(),
}));

vi.mock("@/lib/knowledge-health", () => ({
  buildKnowledgeHealthItemDetail: (...args: unknown[]) =>
    buildKnowledgeHealthItemDetailMock(...args),
}));

import { handleGetKnowledgeHealthItemDetail as GET } from "@/modules/assistant-shell/routes/knowledge-health-item-detail";

const mockRepo = {};

beforeEach(() => {
  buildKnowledgeHealthItemDetailMock.mockReset();
  isFeatureEnabledMock.mockReset();
  featureNotFoundMock.mockReset();
  getLlmRepoMock.mockReset();
  isFeatureEnabledMock.mockReturnValue(true);
  getLlmRepoMock.mockReturnValue(mockRepo);
});

function callGET(id: string) {
  return GET(id);
}

describe("GET /api/assistant/knowledge-health/items/[id]", () => {
  it("returns 404 when assistant is disabled", async () => {
    isFeatureEnabledMock.mockReturnValue(false);
    featureNotFoundMock.mockReturnValue(
      new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
    );

    const res = await callGET("item-1");
    expect(res.status).toBe(404);
  });

  it("returns item detail", async () => {
    const detail = { id: "mem-1", type: "memory", content: "User prefers dark mode" };
    buildKnowledgeHealthItemDetailMock.mockResolvedValue(detail);

    const res = await callGET("mem-1");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.item).toEqual(detail);
    expect(buildKnowledgeHealthItemDetailMock).toHaveBeenCalledWith(mockRepo, "mem-1");
  });

  it("returns 404 when item not found", async () => {
    buildKnowledgeHealthItemDetailMock.mockResolvedValue(null);

    const res = await callGET("nonexistent");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Item not found");
  });

  it("returns 500 on error", async () => {
    buildKnowledgeHealthItemDetailMock.mockRejectedValue(new Error("DB error"));

    const res = await callGET("mem-1");
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB error");
  });
});
