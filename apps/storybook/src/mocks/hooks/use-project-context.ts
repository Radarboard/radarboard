export function useProjectContext() {
  return {
    contextMap: {},
    getContext: () => ({
      goals: [],
      priorities: [],
      notes: "",
      stage: "planning",
    }),
    updateContext: () => undefined,
    isLoaded: true,
  };
}
