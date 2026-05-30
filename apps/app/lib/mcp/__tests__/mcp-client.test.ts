import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMcpClient, McpClient, McpClientError, resetMcpClients } from "../mcp-client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  resetMcpClients();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.restoreAllMocks());

function mockInitResponse(sessionId = "sess-1") {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "mcp-session-id": sessionId }),
    text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }),
  };
}

function mockToolResponse(result: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ jsonrpc: "2.0", id: 2, result }),
  };
}

describe("McpClient", () => {
  describe("callTool", () => {
    it("initializes session then calls tool", async () => {
      fetchMock.mockResolvedValueOnce(mockInitResponse()).mockResolvedValueOnce(
        mockToolResponse({
          content: [{ type: "text", text: '{"answer":42}' }],
        })
      );

      const client = new McpClient("http://mcp.test/mcp");
      const result = await client.callTool("my-tool", { q: "test" });

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: "text",
        text: '{"answer":42}',
      });

      // First call = initialize, second = tools/call
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("reuses session for subsequent calls", async () => {
      fetchMock
        .mockResolvedValueOnce(mockInitResponse("sess-abc"))
        .mockResolvedValueOnce(mockToolResponse({ content: [{ type: "text", text: "1" }] }))
        .mockResolvedValueOnce(mockToolResponse({ content: [{ type: "text", text: "2" }] }));

      const client = new McpClient("http://mcp.test/mcp");
      await client.callTool("tool1", {});
      await client.callTool("tool2", {});

      // Only 1 initialize + 2 tool calls = 3 total
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Second and third calls should include session header
      const lastCallHeaders = fetchMock.mock.calls[2][1].headers;
      expect(lastCallHeaders["mcp-session-id"]).toBe("sess-abc");
    });

    it("throws McpClientError on initialize failure", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers(),
        text: async () => "Service Unavailable",
      });

      const client = new McpClient("http://mcp.test/mcp");

      await expect(client.callTool("tool", {})).rejects.toThrow(McpClientError);
    });

    it("retries initialization after failure", async () => {
      // First init fails
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
        text: async () => "Service Unavailable",
      });

      const client = new McpClient("http://mcp.test/mcp");
      await expect(client.callTool("tool", {})).rejects.toThrow();

      // Second attempt succeeds
      fetchMock
        .mockResolvedValueOnce(mockInitResponse())
        .mockResolvedValueOnce(mockToolResponse({ content: [{ type: "text", text: "ok" }] }));

      const result = await client.callTool("tool", {});
      expect(result.content[0]).toEqual({ type: "text", text: "ok" });
    });

    it("throws McpClientError on tool call failure", async () => {
      fetchMock.mockResolvedValueOnce(mockInitResponse()).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: async () => "Internal Error",
      });

      const client = new McpClient("http://mcp.test/mcp");

      await expect(client.callTool("broken", {})).rejects.toThrow(/500/);
    });

    it("throws on MCP protocol error in response", async () => {
      fetchMock.mockResolvedValueOnce(mockInitResponse()).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            error: { message: "Tool not found", code: -32601 },
          }),
      });

      const client = new McpClient("http://mcp.test/mcp");

      await expect(client.callTool("missing-tool", {})).rejects.toThrow("Tool not found");
    });

    it("handles SSE envelope responses", async () => {
      fetchMock.mockResolvedValueOnce(mockInitResponse()).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () =>
          `data: ${JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: { content: [{ type: "text", text: "sse-data" }] },
          })}\n\n`,
      });

      const client = new McpClient("http://mcp.test/mcp");
      const result = await client.callTool("tool", {});

      expect(result.content[0]).toEqual({ type: "text", text: "sse-data" });
    });

    it("sends auth header when configured", async () => {
      fetchMock
        .mockResolvedValueOnce(mockInitResponse())
        .mockResolvedValueOnce(mockToolResponse({ content: [{ type: "text", text: "ok" }] }));

      const client = new McpClient("http://mcp.test/mcp", "Bearer my-token");
      await client.callTool("tool", {});

      const initHeaders = fetchMock.mock.calls[0][1].headers;
      expect(initHeaders.Authorization).toBe("Bearer my-token");
    });
  });

  describe("callToolJson", () => {
    it("parses JSON from first text content", async () => {
      fetchMock.mockResolvedValueOnce(mockInitResponse()).mockResolvedValueOnce(
        mockToolResponse({
          content: [{ type: "text", text: '{"count":5}' }],
        })
      );

      const client = new McpClient("http://mcp.test/mcp");
      const data = await client.callToolJson<{ count: number }>("tool", {});

      expect(data.count).toBe(5);
    });

    it("throws when isError is true", async () => {
      fetchMock.mockResolvedValueOnce(mockInitResponse()).mockResolvedValueOnce(
        mockToolResponse({
          content: [{ type: "text", text: "Something went wrong" }],
          isError: true,
        })
      );

      const client = new McpClient("http://mcp.test/mcp");

      await expect(client.callToolJson("tool", {})).rejects.toThrow("Something went wrong");
    });

    it("throws when no text content", async () => {
      fetchMock.mockResolvedValueOnce(mockInitResponse()).mockResolvedValueOnce(
        mockToolResponse({
          content: [{ type: "image", data: "base64", mimeType: "image/png" }],
        })
      );

      const client = new McpClient("http://mcp.test/mcp");

      await expect(client.callToolJson("tool", {})).rejects.toThrow(/no text content/);
    });
  });
});

describe("getMcpClient", () => {
  it("returns same client for same URL", () => {
    const a = getMcpClient("http://mcp.test/mcp");
    const b = getMcpClient("http://mcp.test/mcp");

    expect(a).toBe(b);
  });

  it("returns different clients for different URLs", () => {
    const a = getMcpClient("http://mcp-a.test/mcp");
    const b = getMcpClient("http://mcp-b.test/mcp");

    expect(a).not.toBe(b);
  });

  it("returns different clients for same URL with different auth", () => {
    const a = getMcpClient("http://mcp.test/mcp", "Bearer token-a");
    const b = getMcpClient("http://mcp.test/mcp", "Bearer token-b");

    expect(a).not.toBe(b);
  });
});

describe("McpClientError", () => {
  it("includes code property", () => {
    const err = new McpClientError("not found", -32601);
    expect(err.code).toBe(-32601);
    expect(err.name).toBe("McpClientError");
    expect(err.message).toBe("not found");
  });
});
