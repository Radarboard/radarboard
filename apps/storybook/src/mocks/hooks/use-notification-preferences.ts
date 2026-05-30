export function useNotificationPreferences() {
  return {
    preferences: [],
    loading: false,
    error: null,
    savePreference: async () => undefined,
    refetch: async () => undefined,
  };
}
