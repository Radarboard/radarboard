export function useDisabledPlugins() {
  return new Set<string>();
}

export function useDisabledPluginsState() {
  return {
    disabledIds: new Set<string>(),
    isLoading: false,
    setPluginEnabled: () => undefined,
  };
}
