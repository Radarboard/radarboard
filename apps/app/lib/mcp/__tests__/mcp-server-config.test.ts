import { describe, expect, it } from "vitest";
import {
  buildCredentialReference,
  formatStdioLaunchError,
  normalizeStdioCommand,
  normalizeStdioServerConfig,
  parseStoredMcpServerConfig,
  resolveMcpServerConfig,
  serializeMcpServerConfig,
  splitCommandLine,
} from "../mcp-server-config";

describe("mcp-server-config", () => {
  describe("splitCommandLine", () => {
    it("splits shell-like command lines", () => {
      expect(splitCommandLine('npx -y "@adeze/raindrop-mcp@latest"')).toEqual([
        "npx",
        "-y",
        "@adeze/raindrop-mcp@latest",
      ]);
    });
  });

  describe("normalizeStdioCommand", () => {
    it("normalizes pasted full command lines into command plus args", () => {
      expect(normalizeStdioCommand("npx -y @adeze/raindrop-mcp@latest")).toEqual({
        command: "npx",
        args: ["-y", "@adeze/raindrop-mcp@latest"],
      });
    });

    it("keeps explicit args and appends them after inline args", () => {
      expect(normalizeStdioCommand("npx -y", ["@adeze/raindrop-mcp@latest"])).toEqual({
        command: "npx",
        args: ["-y", "@adeze/raindrop-mcp@latest"],
      });
    });

    it("reorders misplaced npx yes flags ahead of the package name", () => {
      expect(normalizeStdioCommand("npx", ["@adeze/raindrop-mcp@latest", "-y"])).toEqual({
        command: "npx",
        args: ["-y", "@adeze/raindrop-mcp@latest"],
      });
    });
  });

  describe("normalizeStdioServerConfig", () => {
    it("normalizes persisted stdio servers", () => {
      expect(
        normalizeStdioServerConfig({
          name: "raindrop",
          type: "stdio",
          command: "npx -y @adeze/raindrop-mcp@latest",
          enabled: true,
        })
      ).toEqual({
        name: "raindrop",
        type: "stdio",
        command: "npx",
        args: ["-y", "@adeze/raindrop-mcp@latest"],
        enabled: true,
      });
    });
  });

  describe("formatStdioLaunchError", () => {
    it("explains ENOENT in plain language", () => {
      expect(
        formatStdioLaunchError({
          command: "npx",
          args: ["-y", "@adeze/raindrop-mcp@latest"],
          message: "spawn npx ENOENT",
        })
      ).toContain("Executable not found: npx");
    });

    it("explains first-run npx install timeouts", () => {
      expect(
        formatStdioLaunchError({
          command: "npx",
          args: ["-y", "@adeze/raindrop-mcp@latest"],
          message: "Connection timed out after 30s",
          stderr:
            "npm warn exec The following package was not found and will be installed: @adeze/raindrop-mcp@2.4.5",
        })
      ).toContain("npx is still downloading the package on first run");
    });
  });

  it("explains missing required environment variables", () => {
    expect(
      formatStdioLaunchError({
        command: "npx",
        args: ["-y", "@adeze/raindrop-mcp@latest"],
        message: "MCP error -32000: Connection closed",
        stderr:
          "ERROR: RAINDROP_ACCESS_TOKEN environment variable is required\nPlease set your Raindrop.io API token before starting the server.",
      })
    ).toContain("Missing required environment variable: RAINDROP_ACCESS_TOKEN");
  });

  it("round-trips referenced stdio env values", () => {
    const server = {
      name: "raindrop",
      type: "stdio" as const,
      command: "npx",
      args: ["-y", "@adeze/raindrop-mcp@latest"],
      env: {
        RAINDROP_ACCESS_TOKEN: buildCredentialReference("raindrop", "accessToken"),
      },
      enabled: true,
    };

    expect(parseStoredMcpServerConfig("raindrop", serializeMcpServerConfig(server))).toEqual(
      server
    );
  });

  it("round-trips referenced auth headers", () => {
    const server = {
      name: "remote",
      type: "streamable-http" as const,
      url: "https://example.com/mcp",
      authHeader: buildCredentialReference("sentry", "authToken", "Bearer {{value}}"),
      enabled: true,
    };

    expect(parseStoredMcpServerConfig("remote", serializeMcpServerConfig(server))).toEqual(server);
  });

  it("resolves referenced credential values before launch", async () => {
    const resolved = await resolveMcpServerConfig(
      {
        name: "raindrop",
        type: "stdio",
        command: "npx",
        args: ["-y", "@adeze/raindrop-mcp@latest"],
        env: {
          RAINDROP_ACCESS_TOKEN: buildCredentialReference("raindrop", "accessToken"),
        },
        enabled: true,
      },
      async (key) => (key === "raindrop" ? { accessToken: "rd_secret" } : null)
    );

    expect(resolved).toMatchObject({
      env: {
        RAINDROP_ACCESS_TOKEN: "rd_secret",
      },
    });
  });

  it("applies credential templates when resolving", async () => {
    const resolved = await resolveMcpServerConfig(
      {
        name: "remote",
        type: "streamable-http",
        url: "https://example.com/mcp",
        authHeader: buildCredentialReference("sentry", "authToken", "Bearer {{value}}"),
        enabled: true,
      },
      async (key) => (key === "sentry" ? { authToken: "token123" } : null)
    );

    expect(resolved.authHeader).toBe("Bearer token123");
  });
});
