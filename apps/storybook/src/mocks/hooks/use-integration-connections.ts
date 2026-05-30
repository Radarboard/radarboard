export function useIntegrationConnections() {
  return {
    connections: [],
    providers: [],
    loading: false,
    error: null,
    refetch: async () => undefined,
    addOrUpdate: async () => undefined,
    remove: async () => undefined,
  };
}
