import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLlmRepo = {
  listArtifacts: vi.fn().mockResolvedValue([]),
  getArtifact: vi.fn().mockResolvedValue(null),
  upsertArtifact: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/db/repository", () => ({
  getLlmRepo: () => mockLlmRepo,
}));

vi.mock("@/lib/features", () => ({
  isFeatureEnabled: () => true,
  featureNotFound: () => new Response("Not Found", { status: 404 }),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { handleGetArtifact, handleListArtifacts, handleUpsertArtifact } from "../artifacts";

beforeEach(() => vi.clearAllMocks());

describe("handleListArtifacts", () => {
  it("returns artifacts with default limit", async () => {
    mockLlmRepo.listArtifacts.mockResolvedValue([{ id: "art-1", title: "Report" }]);

    const res = await handleListArtifacts(new Request("http://localhost/api/chat/artifacts"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(mockLlmRepo.listArtifacts).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });

  it("passes filter params", async () => {
    mockLlmRepo.listArtifacts.mockResolvedValue([]);

    await handleListArtifacts(
      new Request("http://localhost/api/chat/artifacts?mode=explore&projectSlug=my-app&limit=5")
    );

    expect(mockLlmRepo.listArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "explore",
        projectSlug: "my-app",
        limit: 5,
      })
    );
  });

  it("ignores invalid mode values", async () => {
    mockLlmRepo.listArtifacts.mockResolvedValue([]);

    await handleListArtifacts(new Request("http://localhost/api/chat/artifacts?mode=invalid"));

    expect(mockLlmRepo.listArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ mode: undefined })
    );
  });
});

describe("handleUpsertArtifact", () => {
  const validBody = {
    mode: "explore",
    title: "Architecture Review",
    summary: "Reviewed service boundaries",
    body: "# Findings\n\nAll looks good.",
  };

  function makeRequest(payload: unknown): Request {
    return new Request("http://localhost/api/chat/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  it("creates an artifact with required fields", async () => {
    const res = await handleUpsertArtifact(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe("explore");
    expect(body.title).toBe("Architecture Review");
    expect(body.contentType).toBe("markdown"); // default
    expect(body.status).toBe("completed"); // default
    expect(mockLlmRepo.upsertArtifact).toHaveBeenCalled();
  });

  it("generates a UUID when id is not provided", async () => {
    const res = await handleUpsertArtifact(makeRequest(validBody));
    const body = await res.json();

    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("uses provided id when given", async () => {
    const res = await handleUpsertArtifact(makeRequest({ ...validBody, id: "custom-id" }));
    const body = await res.json();

    expect(body.id).toBe("custom-id");
  });

  it("rejects invalid mode", async () => {
    const res = await handleUpsertArtifact(makeRequest({ ...validBody, mode: "default" }));

    expect(res.status).toBe(400);
  });

  it("rejects missing title", async () => {
    const res = await handleUpsertArtifact(makeRequest({ ...validBody, title: "" }));

    expect(res.status).toBe(400);
  });

  it("rejects missing body", async () => {
    const res = await handleUpsertArtifact(makeRequest({ ...validBody, body: "" }));

    expect(res.status).toBe(400);
  });

  it("rejects invalid status", async () => {
    const res = await handleUpsertArtifact(makeRequest({ ...validBody, status: "archived" }));

    expect(res.status).toBe(400);
  });

  it("accepts valid contentType values", async () => {
    for (const contentType of ["markdown", "html", "mermaid"]) {
      const res = await handleUpsertArtifact(makeRequest({ ...validBody, contentType }));
      const body = await res.json();
      expect(body.contentType).toBe(contentType);
    }
  });

  it("parses evidence refs correctly", async () => {
    const res = await handleUpsertArtifact(
      makeRequest({
        ...validBody,
        evidenceRefs: [
          { kind: "url", label: "Docs", url: "https://docs.example.com" },
          { kind: "entity", label: "Service A" },
          { label: "" }, // should be filtered out (empty label)
        ],
      })
    );
    const body = await res.json();

    expect(body.evidenceRefs).toHaveLength(2);
    expect(body.evidenceRefs[0]).toEqual({
      kind: "url",
      label: "Docs",
      url: "https://docs.example.com",
    });
  });

  it("defaults evidence ref kind to 'entity' for unknown values", async () => {
    const res = await handleUpsertArtifact(
      makeRequest({
        ...validBody,
        evidenceRefs: [{ kind: "unknown_kind", label: "Test" }],
      })
    );
    const body = await res.json();

    expect(body.evidenceRefs[0].kind).toBe("entity");
  });
});

describe("handleGetArtifact", () => {
  it("returns artifact by id", async () => {
    mockLlmRepo.getArtifact.mockResolvedValue({
      id: "art-1",
      title: "Report",
    });

    const res = await handleGetArtifact("art-1");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("art-1");
  });

  it("returns 404 when artifact not found", async () => {
    mockLlmRepo.getArtifact.mockResolvedValue(null);

    const res = await handleGetArtifact("nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 500 on repo error", async () => {
    mockLlmRepo.getArtifact.mockRejectedValue(new Error("DB error"));

    const res = await handleGetArtifact("art-1");
    expect(res.status).toBe(500);
  });
});
