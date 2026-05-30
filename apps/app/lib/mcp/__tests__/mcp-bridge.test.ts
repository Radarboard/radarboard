import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, expect, it, vi } from "vitest";
import { buildMcpServerConfig, discoverMcpServers } from "../mcp-bridge";

const mockCredentialRepo = {
  getCredential: vi.fn(),
  setCredential: vi.fn(),
  deleteCredential: vi.fn(),
  listCredentialKeys: vi.fn(),
};

vi.mock("@/data/core/repository", () => ({
  getCredentialRepo: () => mockCredentialRepo,
}));

describe("mcp-bridge", () => {
  describe("discoverMcpServers", () => {
    it("returns empty array when no mcp keys exist", async () => {
      mockCredentialRepo.listCredentialKeys.mockResolvedValue([]);
      const servers = await discoverMcpServers();
      expect(servers).toEqual([]);
    });

    it("discovers enabled MCP servers from credential store", async () => {
      mockCredentialRepo.listCredentialKeys.mockResolvedValue([
        "mcp::astro",
        "revenuecat",
        "mcp::custom-server",
      ]);
      mockCredentialRepo.getCredential.mockImplementation(async (key: string) => {
        if (key === "mcp::astro")
          return { url: "http://localhost:8089/mcp", type: "streamable-http", enabled: "true" };
        if (key === "mcp::custom-server")
          return { url: "http://localhost:9000/mcp", type: "streamable-http", enabled: "false" };
        return null;
      });

      const servers = await discoverMcpServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe("astro");
      expect(servers[0]).toMatchObject({
        name: "astro",
        type: "streamable-http",
        url: "http://localhost:8089/mcp",
        enabled: true,
      });
    });

    it("discovers enabled stdio MCP servers from credential store", async () => {
      mockCredentialRepo.listCredentialKeys.mockResolvedValue(["mcp::openpanel"]);
      mockCredentialRepo.getCredential.mockResolvedValue({
        type: "stdio",
        command: "npx",
        args: JSON.stringify(["-y", "openpanel-mcp-server"]),
        env: JSON.stringify({ OPENPANEL_CLIENT_ID: "test-id" }),
        cwd: "/tmp/openpanel",
        enabled: "true",
      });

      const servers = await discoverMcpServers();

      expect(servers).toEqual([
        {
          name: "openpanel",
          type: "stdio",
          command: "npx",
          args: ["-y", "openpanel-mcp-server"],
          env: { OPENPANEL_CLIENT_ID: "test-id" },
          cwd: "/tmp/openpanel",
          enabled: true,
        },
      ]);
    });

    it("resolves referenced credential values during discovery", async () => {
      mockCredentialRepo.listCredentialKeys.mockResolvedValue(["mcp::raindrop", "raindrop"]);
      mockCredentialRepo.getCredential.mockImplementation(async (key: string) => {
        if (key === "mcp::raindrop") {
          return {
            type: "stdio",
            command: "npx",
            args: JSON.stringify(["-y", "@adeze/raindrop-mcp@latest"]),
            env: JSON.stringify({
              RAINDROP_ACCESS_TOKEN: {
                type: "integration-credential",
                credentialKey: "raindrop",
                field: "accessToken",
              },
            }),
            enabled: "true",
          };
        }
        if (key === "raindrop") {
          return { accessToken: "rd_secret" };
        }
        return null;
      });

      const servers = await discoverMcpServers();

      expect(servers).toEqual([
        {
          name: "raindrop",
          type: "stdio",
          command: "npx",
          args: ["-y", "@adeze/raindrop-mcp@latest"],
          env: { RAINDROP_ACCESS_TOKEN: "rd_secret" },
          enabled: true,
        },
      ]);
    });
  });

  describe("buildMcpServerConfig", () => {
    it("builds streamable HTTP transport for a remote MCP server", () => {
      const config = buildMcpServerConfig({
        name: "astro",
        url: "http://localhost:8089/mcp",
        type: "streamable-http",
        enabled: true,
      });

      expect(config).toBeInstanceOf(StreamableHTTPClientTransport);
    });

    it("includes auth header when provided", () => {
      const config = buildMcpServerConfig({
        name: "astro",
        url: "http://localhost:8089/mcp",
        type: "streamable-http",
        authHeader: "Bearer test-token",
        enabled: true,
      });

      expect(config).toBeInstanceOf(StreamableHTTPClientTransport);
    });

    it("builds stdio transport for local MCP servers", () => {
      const config = buildMcpServerConfig({
        name: "openpanel",
        type: "stdio",
        command: "npx",
        args: ["-y", "openpanel-mcp-server"],
        env: { OPENPANEL_CLIENT_ID: "test-id" },
        cwd: "/tmp/openpanel",
        enabled: true,
      });

      expect(config).toBeInstanceOf(StdioClientTransport);
    });
  });
});
