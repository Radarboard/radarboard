export function useSettings() {
  return {
    projectOrder: ["radarboard"],
    widgetLayout: {},
    projectIntegrations: {},
    updateProjectOrder: () => undefined,
    updateWidgetLayout: () => undefined,
    updateProjectIntegrations: () => undefined,
    isLoading: false,
  };
}
