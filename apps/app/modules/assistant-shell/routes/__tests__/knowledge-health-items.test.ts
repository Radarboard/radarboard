import { beforeEach, describe, expect, it, vi } from "vitest";

const buildKnowledgeHealthItemsMock = vi.fn();
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
  buildKnowledgeHealthItems: (...args: unknown[]) => buildKnowledgeHealthItemsMock(...args),
}));

import { handleGetKnowledgeHealthItems as GET } from "@/modules/assistant-shell/routes/knowledge-health-items";

const mockRepo = {};

beforeEach(() => {
  buildKnowledgeHealthItemsMock.mockReset();
  isFeatureEnabledMock.mockReset();
  featureNotFoundMock.mockReset();
  getLlmRepoMock.mockReset();
  isFeatureEnabledMock.mockReturnValue(true);
  getLlmRepoMock.mockReturnValue(mockRepo);
});

describe("GET /api/assistant/knowledge-health/items", () => {
  it("returns 404 when assistant is disabled", async () => {
    isFeatureEnabledMock.mockReturnValue(false);
    featureNotFoundMock.mockReturnValue(
      new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
    );

    const res = await GET(new Request("http://localhost/api/knowledge-health/items"));
    expect(res.status).toBe(404);
  });

  it("returns items with default filters", async () => {
    const items = { items: [{ id: "m1", type: "memory" }], total: 1 };
    buildKnowledgeHealthItemsMock.mockResolvedValue(items);

    const res = await GET(new Request("http://localhost/api/knowledge-health/items"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(buildKnowledgeHealthItemsMock).toHaveBeenCalledWith(
      mockRepo,
      expect.objectContaining({
        project: null,
        query: null,
      })
    );
  });

  it("passes query params to buildKnowledgeHealthItems", async () => {
    buildKnowledgeHealthItemsMock.mockResolvedValue({ items: [], total: 0 });

    const url =
      "http://localhost/api/knowledge-health/items?project=my-app&type=memory&stale=true&page=2&limit=10";
    await GET(new Request(url));

    expect(buildKnowledgeHealthItemsMock).toHaveBeenCalledWith(
      mockRepo,
      expect.objectContaining({
        project: "my-app",
        type: "memory",
        stale: true,
        page: 2,
        limit: 10,
      })
    );
  });

  it("converts stale=false correctly", async () => {
    buildKnowledgeHealthItemsMock.mockResolvedValue({ items: [] });

    await GET(new Request("http://localhost/api/knowledge-health/items?stale=false"));

    expect(buildKnowledgeHealthItemsMock).toHaveBeenCalledWith(
      mockRepo,
      expect.objectContaining({ stale: false })
    );
  });

  it("treats stale=all as 'all'", async () => {
    buildKnowledgeHealthItemsMock.mockResolvedValue({ items: [] });

    await GET(new Request("http://localhost/api/knowledge-health/items?stale=all"));

    expect(buildKnowledgeHealthItemsMock).toHaveBeenCalledWith(
      mockRepo,
      expect.objectContaining({ stale: "all" })
    );
  });

  it("rejects invalid type parameter", async () => {
    const res = await GET(new Request("http://localhost/api/knowledge-health/items?type=invalid"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid/);
  });

  it("rejects page < 1", async () => {
    const res = await GET(new Request("http://localhost/api/knowledge-health/items?page=0"));

    expect(res.status).toBe(400);
  });

  it("rejects limit > 100", async () => {
    const res = await GET(new Request("http://localhost/api/knowledge-health/items?limit=200"));

    expect(res.status).toBe(400);
  });

  it("returns 500 on service error", async () => {
    buildKnowledgeHealthItemsMock.mockRejectedValue(new Error("Query failed"));

    const res = await GET(new Request("http://localhost/api/knowledge-health/items"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Query failed");
  });
});
