"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { isIntegrationBackedDashboardDataKey } from "@/lib/integration-data-invalidation";

export const PROJECT_GRAPH_INVALIDATION_EVENT = "radarboard:project-graph-changed";

export function notifyProjectGraphChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECT_GRAPH_INVALIDATION_EVENT));
}

export function useProjectGraphInvalidation() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const handleInvalidation = () => {
      mutate(isIntegrationBackedDashboardDataKey, undefined, { revalidate: true }).catch(
        () => undefined
      );
    };

    window.addEventListener(PROJECT_GRAPH_INVALIDATION_EVENT, handleInvalidation);
    return () => window.removeEventListener(PROJECT_GRAPH_INVALIDATION_EVENT, handleInvalidation);
  }, [mutate]);
}
