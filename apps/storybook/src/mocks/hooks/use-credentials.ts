export function useCredentials() {
  return {
    connectedKeys: ["github", "vercel", "sentry"],
    loading: false,
    error: null,
    refetch: async () => undefined,
  };
}
