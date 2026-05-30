import type { CredentialRepository } from "@radarboard/types/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repository", () => ({
  getCredentialRepo: vi.fn(),
}));

vi.mock("@/lib/debug-events", () => ({
  emitDebugEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/mcp-server-config", () => ({
  parseStoredMcpServerConfig: vi.fn(),
  serializeMcpServerConfig: vi.fn(),
}));

type SchemaLike = {
  safeParse: (value: unknown) => {
    success: boolean;
    data?: unknown;
    error?: { issues?: Array<{ path: (string | number)[]; message: string }> };
  };
};

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    parseBody: async (request: Request, schema: SchemaLike) => {
      const payload = await request.json();
      const result = schema.safeParse(payload);
      if (result.success) return { ok: true as const, data: result.data };
      const issues = result.error?.issues ?? [];
      return {
        ok: false as const,
        response: new Response(
          JSON.stringify({
            error: issues[0]?.message ?? "Invalid request",
            issues: issues.map((e) => ({ path: e.path, message: e.message })),
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        ),
      };
    },
  };
});

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { getCredentialRepo } from "@/db/repository";
import { parseStoredMcpServerConfig, serializeMcpServerConfig } from "@/lib/mcp-server-config";
import { handleDeleteMcpServer, handleListMcpServers, handleSaveMcpServer } from "../servers";

const mockRepo: Record<keyof CredentialRepository, ReturnType<typeof vi.fn>> = {
  getCredential: vi.fn(),
  setCredential: vi.fn(),
  deleteCredential: vi.fn(),
  listCredentialKeys: vi.fn(),
};

beforeEach(() => {
  for (const fn of Object.values(mockRepo)) fn.mockReset();
  vi.mocked(getCredentialRepo).mockReturnValue(mockRepo as unknown as CredentialRepository);
  vi.mocked(parseStoredMcpServerConfig).mockReset();
  vi.mocked(serializeMcpServerConfig).mockReset();
});

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/mcp/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("handleListMcpServers", () => {
  it("returns empty array when no MCP keys exist", async () => {
    mockRepo.listCredentialKeys.mockResolvedValue(["sentry", "github"]);

    const res = await handleListMcpServers();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.servers).toEqual([]);
  });

  it("parses and returns MCP server configs sorted by name", async () => {
    mockRepo.listCredentialKeys.mockResolvedValue(["mcp::zebra", "mcp::alpha"]);
    mockRepo.getCredential.mockResolvedValue({ url: "http://localhost:9000" });
    vi.mocked(parseStoredMcpServerConfig).mockImplementation((name) => ({
      name,
      type: "streamable-http",
      url: "http://localhost:9000",
      enabled: true,
    }));

    const res = await handleListMcpServers();
    const body = await res.json();

    expect(body.servers).toHaveLength(2);
    expect(body.servers[0].name).toBe("alpha");
    expect(body.servers[1].name).toBe("zebra");
  });

  it("handles table-not-found error gracefully", async () => {
    mockRepo.listCredentialKeys.mockRejectedValue(new Error("no such table: widget_credentials"));

    const res = await handleListMcpServers();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.servers).toEqual([]);
  });

  it("skips malformed credentials silently", async () => {
    mockRepo.listCredentialKeys.mockResolvedValue(["mcp::good", "mcp::bad"]);
    mockRepo.getCredential.mockImplementation(async (key: string) => {
      if (key === "mcp::bad") throw new Error("corrupt");
      return { url: "http://localhost" };
    });
    vi.mocked(parseStoredMcpServerConfig).mockReturnValue({
      name: "good",
      type: "streamable-http",
      url: "http://localhost",
      enabled: true,
    });

    const res = await handleListMcpServers();
    const body = await res.json();

    expect(body.servers).toHaveLength(1);
    expect(body.servers[0].name).toBe("good");
  });
});

describe("handleSaveMcpServer", () => {
  it("saves an HTTP server", async () => {
    const serialized = { url: "http://localhost:9000", type: "streamable-http", enabled: "true" };
    vi.mocked(serializeMcpServerConfig).mockReturnValue(serialized);
    vi.mocked(parseStoredMcpServerConfig).mockReturnValue({
      name: "my-server",
      type: "streamable-http",
      url: "http://localhost:9000",
      enabled: true,
    });

    const res = await handleSaveMcpServer(
      makeRequest({
        name: "my-server",
        type: "streamable-http",
        url: "http://localhost:9000",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRepo.setCredential).toHaveBeenCalledWith("mcp::my-server", serialized);
  });

  it("saves a stdio server", async () => {
    const serialized = { command: "npx", type: "stdio" };
    vi.mocked(serializeMcpServerConfig).mockReturnValue(serialized);
    vi.mocked(parseStoredMcpServerConfig).mockReturnValue({
      name: "local-tool",
      type: "stdio",
      command: "npx",
      enabled: true,
    });

    const res = await handleSaveMcpServer(
      makeRequest({
        name: "local-tool",
        type: "stdio",
        command: "npx mcp-server",
      })
    );

    expect(res.status).toBe(200);
  });

  it("defaults type to streamable-http when not provided", async () => {
    vi.mocked(serializeMcpServerConfig).mockReturnValue({});
    vi.mocked(parseStoredMcpServerConfig).mockReturnValue({
      name: "test",
      type: "streamable-http",
      url: "https://mcp.example.com",
      enabled: true,
    });

    const res = await handleSaveMcpServer(
      makeRequest({ name: "test", url: "https://mcp.example.com" })
    );
    expect(res.status).toBe(200);
  });

  it("rejects invalid name characters", async () => {
    const res = await handleSaveMcpServer(
      makeRequest({ name: "My Server!", type: "streamable-http", url: "http://localhost" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-http URL", async () => {
    const res = await handleSaveMcpServer(
      makeRequest({ name: "ftp-server", type: "streamable-http", url: "ftp://files.com" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing name", async () => {
    const res = await handleSaveMcpServer(
      makeRequest({ type: "streamable-http", url: "http://localhost" })
    );
    expect(res.status).toBe(400);
  });
});

describe("handleDeleteMcpServer", () => {
  it("deletes an existing server", async () => {
    mockRepo.getCredential.mockResolvedValue({ url: "http://localhost" });
    mockRepo.deleteCredential.mockResolvedValue(undefined);

    const res = await handleDeleteMcpServer(makeRequest({ name: "my-server" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRepo.deleteCredential).toHaveBeenCalledWith("mcp::my-server");
  });

  it("returns 404 for non-existent server", async () => {
    mockRepo.getCredential.mockResolvedValue(null);

    const res = await handleDeleteMcpServer(makeRequest({ name: "ghost" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain("ghost");
  });

  it("rejects missing name", async () => {
    const res = await handleDeleteMcpServer(makeRequest({}));
    expect(res.status).toBe(400);
  });
});
