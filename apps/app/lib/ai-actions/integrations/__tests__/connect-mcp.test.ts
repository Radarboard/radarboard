import { beforeEach, describe, expect, it, vi } from "vitest";

const setCredential = vi.fn();
const serializeMcpServerConfig = vi.fn((server: unknown) => ({ serialized: server }));
const verifyHttpMcpConnection = vi.fn();

vi.mock("@/data/core/repository", () => ({
  getCredentialRepo: () => ({ setCredential }),
}));

vi.mock("@/lib/mcp/mcp-server-config", () => ({
  serializeMcpServerConfig: (server: unknown) => serializeMcpServerConfig(server),
}));

vi.mock("@/lib/mcp/verify-http-mcp", () => ({
  verifyHttpMcpConnection: (...args: unknown[]) => verifyHttpMcpConnection(...args),
}));

import { executeConnectMcp } from "../connect-mcp";

beforeEach(() => {
  vi.clearAllMocks();
  setCredential.mockResolvedValue(undefined);
  verifyHttpMcpConnection.mockResolvedValue({ ok: true, serverName: "Sentry" });
});

describe("executeConnectMcp", () => {
  it("blocks and asks for confirmation when confirmedByUser is absent", async () => {
    const res = await executeConnectMcp({ name: "sentry", url: "https://mcp.sentry.dev/mcp" });
    expect(res.connected).toBe(false);
    expect(res.requiresConfirmation).toBe(true);
    expect(setCredential).not.toHaveBeenCalled();
  });

  it("rejects an invalid server name", async () => {
    const res = await executeConnectMcp({
      name: "Bad Name",
      url: "https://x.test/mcp",
      confirmedByUser: true,
    });
    expect(res.connected).toBe(false);
    expect(res.error).toMatch(/Invalid name/);
    expect(setCredential).not.toHaveBeenCalled();
  });

  it("rejects a non-https, non-localhost endpoint (egress guard)", async () => {
    const res = await executeConnectMcp({
      name: "evil",
      url: "http://evil.example.com/mcp",
      confirmedByUser: true,
    });
    expect(res.connected).toBe(false);
    expect(res.error).toMatch(/https/);
    expect(setCredential).not.toHaveBeenCalled();
  });

  it("connects an https server and stores it under the mcp:: key", async () => {
    const res = await executeConnectMcp({
      name: "sentry",
      url: "https://mcp.sentry.dev/mcp",
      authHeader: "Bearer tok",
      confirmedByUser: true,
    });
    expect(res).toEqual({
      connected: true,
      name: "sentry",
      verified: true,
      serverName: "Sentry",
    });
    expect(verifyHttpMcpConnection).toHaveBeenCalledWith(
      "https://mcp.sentry.dev/mcp",
      "Bearer tok"
    );
    expect(serializeMcpServerConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "sentry",
        type: "streamable-http",
        url: "https://mcp.sentry.dev/mcp",
        authHeader: "Bearer tok",
        enabled: true,
      })
    );
    expect(setCredential).toHaveBeenCalledWith("mcp::sentry", { serialized: expect.anything() });
  });

  it("does NOT save when the handshake fails", async () => {
    verifyHttpMcpConnection.mockResolvedValue({ ok: false, error: "HTTP 401" });
    const res = await executeConnectMcp({
      name: "sentry",
      url: "https://mcp.sentry.dev/mcp",
      authHeader: "Bearer bad",
      confirmedByUser: true,
    });
    expect(res.connected).toBe(false);
    expect(res.verified).toBe(false);
    expect(res.error).toMatch(/Couldn't reach the MCP server.*401/);
    expect(setCredential).not.toHaveBeenCalled();
  });

  it("skips the handshake when skipVerify is set", async () => {
    const res = await executeConnectMcp({
      name: "sentry",
      url: "https://mcp.sentry.dev/mcp",
      confirmedByUser: true,
      skipVerify: true,
    });
    expect(res.connected).toBe(true);
    expect(res.verified).toBe(false);
    expect(verifyHttpMcpConnection).not.toHaveBeenCalled();
    expect(setCredential).toHaveBeenCalled();
  });

  it("allows http on localhost", async () => {
    const res = await executeConnectMcp({
      name: "local",
      url: "http://localhost:8089/mcp",
      confirmedByUser: true,
    });
    expect(res.connected).toBe(true);
  });

  it("normalizes the name to lowercase", async () => {
    await executeConnectMcp({
      name: "MyServer",
      url: "https://x.test/mcp",
      confirmedByUser: true,
    });
    expect(setCredential).toHaveBeenCalledWith("mcp::myserver", expect.anything());
  });

  it("returns an error when persistence fails", async () => {
    setCredential.mockRejectedValue(new Error("db locked"));
    const res = await executeConnectMcp({
      name: "sentry",
      url: "https://x.test/mcp",
      confirmedByUser: true,
    });
    expect(res.connected).toBe(false);
    expect(res.error).toBe("db locked");
  });
});
