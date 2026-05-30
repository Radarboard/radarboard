import { useCredentials } from "@radarboard/hooks/use-credentials";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { useMemo } from "react";

export function useSetupProgress() {
  const { preferences } = useDashboard();
  const { connectedKeys } = useCredentials();

  return useMemo(() => {
    const intended = preferences.intendedIntegrations ?? [];
    if (intended.length === 0) return { intended: 0, configured: 0, isComplete: true, label: null };

    const configured = intended.filter((key) => connectedKeys.includes(key)).length;
    const isComplete = configured >= intended.length;

    return {
      intended: intended.length,
      configured,
      isComplete,
      label: isComplete ? null : `${configured}/${intended.length}`,
    };
  }, [preferences.intendedIntegrations, connectedKeys]);
}
