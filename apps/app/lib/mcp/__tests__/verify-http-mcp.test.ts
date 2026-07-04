import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyHttpMcpConnection } from "../verify-http-mcp";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("verifyHttpMcpConnection", () => {
  it("returns server info on a successful initialize", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          result: {
            serverInfo: { name: "Sentry", version: "1.2.0" },
            protocolVersion: "2024-11-05",
          },
        })
      )
    );
    const res = await verifyHttpMcpConnection("https://mcp.test/mcp", "Bearer tok");
    expect(res).toEqual({
      ok: true,
      serverName: "Sentry",
      serverVersion: "1.2.0",
      protocolVersion: "2024-11-05",
    });
  });

  it("sends the Authorization header when provided", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ result: {} }));
    vi.stubGlobal("fetch", fetchMock);
    await verifyHttpMcpConnection("https://mcp.test/mcp", "Bearer tok");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok");
  });

  it("parses SSE-framed (data:-prefixed) responses", async () => {
    const sse = `data: ${JSON.stringify({ result: { serverInfo: { name: "S" } } })}\n\n`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(sse))
    );
    const res = await verifyHttpMcpConnection("https://mcp.test/mcp");
    expect(res).toMatchObject({ ok: true, serverName: "S" });
  });

  it("fails on a non-2xx HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse("nope", false, 401))
    );
    const res = await verifyHttpMcpConnection("https://mcp.test/mcp");
    expect(res).toEqual({ ok: false, error: "Server returned HTTP 401" });
  });

  it("surfaces a JSON-RPC error from the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: { message: "bad token" } }))
    );
    const res = await verifyHttpMcpConnection("https://mcp.test/mcp");
    expect(res).toEqual({ ok: false, error: "bad token" });
  });

  it("fails on a non-JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse("<html>nope</html>"))
    );
    const res = await verifyHttpMcpConnection("https://mcp.test/mcp");
    expect(res).toEqual({ ok: false, error: "Server returned non-JSON response" });
  });

  it("reports a timeout when the request aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      })
    );
    const res = await verifyHttpMcpConnection("https://mcp.test/mcp", undefined, 10);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/timed out/);
  });
});
