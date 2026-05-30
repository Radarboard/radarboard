import { beforeEach, describe, expect, it, vi } from "vitest";

const buildKnowledgeHealthProjectMock = vi.fn();
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
  buildKnowledgeHealthProject: (...args: unknown[]) => buildKnowledgeHealthProjectMock(...args),
}));

import { handleGetKnowledgeHealthProject as GET } from "@/modules/assistant-shell/routes/knowledge-health-project";

const mockRepo = {};

beforeEach(() => {
  buildKnowledgeHealthProjectMock.mockReset();
  isFeatureEnabledMock.mockReset();
  featureNotFoundMock.mockReset();
  getLlmRepoMock.mockReset();
  isFeatureEnabledMock.mockReturnValue(true);
  getLlmRepoMock.mockReturnValue(mockRepo);
});

function callGET(slug: string) {
  return GET(slug);
}

describe("GET /api/assistant/knowledge-health/projects/[slug]", () => {
  it("returns 404 when assistant is disabled", async () => {
    isFeatureEnabledMock.mockReturnValue(false);
    featureNotFoundMock.mockReturnValue(
      new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
    );

    const res = await callGET("my-app");
    expect(res.status).toBe(404);
  });

  it("returns project health data", async () => {
    const projectHealth = {
      slug: "my-app",
      totalMemories: 15,
      staleMemories: 2,
    };
    buildKnowledgeHealthProjectMock.mockResolvedValue(projectHealth);

    const res = await callGET("my-app");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(projectHealth);
    expect(buildKnowledgeHealthProjectMock).toHaveBeenCalledWith(mockRepo, "my-app");
  });

  it("returns 500 on error", async () => {
    buildKnowledgeHealthProjectMock.mockRejectedValue(new Error("Lookup failed"));

    const res = await callGET("my-app");
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Lookup failed");
  });
});
