import { beforeEach, describe, expect, it, vi } from "vitest";

const getEmbeddingServiceMock = vi.fn();
const handleEmbeddingsRouteMock = vi.fn();

vi.mock("@/lib/embedding-service-singleton", () => ({
  getEmbeddingService: (...args: unknown[]) => getEmbeddingServiceMock(...args),
}));

vi.mock("@radarboard/plugin-embeddings/server/routes", () => ({
  handleEmbeddingsRoute: (...args: unknown[]) => handleEmbeddingsRouteMock(...args),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { handleEmbeddings as POST } from "@/modules/assistant-shell/routes/embeddings";

beforeEach(() => {
  getEmbeddingServiceMock.mockReset();
  handleEmbeddingsRouteMock.mockReset();
});

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/embeddings", () => {
  it("returns 503 when no embedding service is available", async () => {
    getEmbeddingServiceMock.mockResolvedValue(null);

    const res = await POST(makeRequest({ action: "embed", text: "hello" }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("delegates to handleEmbeddingsRoute when service is available", async () => {
    const mockService = { embed: vi.fn() };
    getEmbeddingServiceMock.mockResolvedValue(mockService);
    handleEmbeddingsRouteMock.mockResolvedValue({
      status: 200,
      payload: { embeddings: [[0.1, 0.2, 0.3]] },
    });

    const res = await POST(makeRequest({ action: "embed", text: "hello" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.embeddings).toEqual([[0.1, 0.2, 0.3]]);
    expect(handleEmbeddingsRouteMock).toHaveBeenCalledWith(
      mockService,
      expect.objectContaining({ action: "embed", text: "hello" })
    );
  });

  it("passes modelId and providerId to getEmbeddingService", async () => {
    getEmbeddingServiceMock.mockResolvedValue(null);

    await POST(
      makeRequest({
        action: "embed",
        text: "hello",
        modelId: "text-embedding-3-small",
        providerId: "openai",
        dimensions: 512,
      })
    );

    expect(getEmbeddingServiceMock).toHaveBeenCalledWith({
      modelId: "text-embedding-3-small",
      providerId: "openai",
      dimensions: 512,
    });
  });

  it("omits dimensions when 0 or negative", async () => {
    getEmbeddingServiceMock.mockResolvedValue(null);

    await POST(makeRequest({ action: "embed", dimensions: 0 }));

    expect(getEmbeddingServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ dimensions: undefined })
    );
  });

  it("returns status from handleEmbeddingsRoute", async () => {
    const mockService = { embed: vi.fn() };
    getEmbeddingServiceMock.mockResolvedValue(mockService);
    handleEmbeddingsRouteMock.mockResolvedValue({
      status: 400,
      payload: { error: "Missing text field" },
    });

    const res = await POST(makeRequest({ action: "embed" }));

    expect(res.status).toBe(400);
  });

  it("returns 500 on unexpected error", async () => {
    getEmbeddingServiceMock.mockRejectedValue(new Error("Config parse error"));

    const res = await POST(makeRequest({ action: "embed" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Config parse error");
  });
});
