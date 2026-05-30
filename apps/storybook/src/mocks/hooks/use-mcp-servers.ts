export function useMcpServers() {
  return {
    servers: [],
    loading: false,
    error: null,
    refetch: async () => undefined,
    addOrUpdate: async () => undefined,
    remove: async () => undefined,
    testConnection: async () => ({
      ok: true,
      serverName: "Mock MCP",
      protocolVersion: "2025-03-26",
    }),
  };
}
