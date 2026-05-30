"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { McpSecretValue, McpServerConfig } from "@radarboard/types/mcp-server";
import { useCallback } from "react";
import useSWR from "swr";
import { apiFetcher } from "./fetcher";

interface McpServersResponse {
  servers: McpServerConfig[];
}

type AddOrUpdatePayload = McpServerConfig;

type TestConnectionPayload =
  | {
      type?: "streamable-http";
      url: string;
      authHeader?: McpSecretValue;
    }
  | {
      type: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, McpSecretValue>;
      cwd?: string;
    };

interface TestResult {
  ok: boolean;
  serverName?: string;
  serverVersion?: string;
  protocolVersion?: string;
  error?: string;
}

/**
 * Hook for managing MCP server configurations.
 *
 * Provides CRUD operations for MCP servers stored in the credential database.
 * Mirrors the pattern of useCredentials() — no polling, only refetches on mutation.
 */
export function useMcpServers() {
  const { data, error, isLoading, mutate } = useSWR<McpServersResponse>(
    API_ROUTES.mcpServers,
    apiFetcher,
    { refreshInterval: 0 } // No polling — only refreshes on mutation
  );

  /**
   * Add a new MCP server or overwrite an existing one (same name = upsert).
   */
  const addOrUpdate = useCallback(
    async (payload: AddOrUpdatePayload): Promise<void> => {
      const res = await fetch(API_ROUTES.mcpServers, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to save MCP server (${res.status})`);
      }

      await mutate();
    },
    [mutate]
  );

  /**
   * Delete an MCP server by name.
   */
  const remove = useCallback(
    async (name: string): Promise<void> => {
      const res = await fetch(API_ROUTES.mcpServers, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to delete MCP server (${res.status})`);
      }

      await mutate();
    },
    [mutate]
  );

  /**
   * Test connectivity to an MCP server URL (does not require the server to be saved first).
   */
  const testConnection = useCallback(
    async (payload: TestConnectionPayload): Promise<TestResult> => {
      const res = await fetch(API_ROUTES.mcpServersTest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await res
        .json()
        .catch(() => ({ ok: false, error: "Invalid response" }))) as TestResult;
      return body;
    },
    []
  );

  return {
    servers: data?.servers ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    refetch: () => mutate(),
    addOrUpdate,
    remove,
    testConnection,
  };
}
