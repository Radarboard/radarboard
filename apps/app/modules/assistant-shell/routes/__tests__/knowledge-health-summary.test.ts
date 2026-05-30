import { beforeEach, describe, expect, it, vi } from "vitest";

const buildKnowledgeHealthSummaryMock = vi.fn();
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
  buildKnowledgeHealthSummary: (...args: unknown[]) => buildKnowledgeHealthSummaryMock(...args),
}));

import { handleGetKnowledgeHealthSummary as GET } from "@/modules/assistant-shell/routes/knowledge-health-summary";

beforeEach(() => {
  buildKnowledgeHealthSummaryMock.mockReset();
  isFeatureEnabledMock.mockReset();
  featureNotFoundMock.mockReset();
  getLlmRepoMock.mockReset();
  isFeatureEnabledMock.mockReturnValue(true);
});

describe("GET /api/assistant/knowledge-health/summary", () => {
  it("returns 404 when assistant is disabled", async () => {
    isFeatureEnabledMock.mockReturnValue(false);
    const notFound = new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    featureNotFoundMock.mockReturnValue(notFound);

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns knowledge health summary", async () => {
    const mockRepo = {};
    getLlmRepoMock.mockReturnValue(mockRepo);
    const summary = {
      totalItems: 42,
      staleItems: 5,
      healthScore: 88,
    };
    buildKnowledgeHealthSummaryMock.mockResolvedValue(summary);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(summary);
    expect(buildKnowledgeHealthSummaryMock).toHaveBeenCalledWith(mockRepo);
  });

  it("returns 500 on error", async () => {
    getLlmRepoMock.mockReturnValue({});
    buildKnowledgeHealthSummaryMock.mockRejectedValue(new Error("DB timeout"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB timeout");
  });
});
