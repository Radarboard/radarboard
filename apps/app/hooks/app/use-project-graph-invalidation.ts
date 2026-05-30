"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";

export const PROJECT_GRAPH_INVALIDATION_EVENT = "radarboard:project-graph-changed";

const PROJECT_GRAPH_INVALIDATION_PREFIXES = ["/api/integrations/", "/api/plugins/changelog/"];

export function notifyProjectGraphChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECT_GRAPH_INVALIDATION_EVENT));
}

export function useProjectGraphInvalidation() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const handleInvalidation = () => {
      mutate(
        (key) =>
          typeof key === "string" &&
          PROJECT_GRAPH_INVALIDATION_PREFIXES.some((prefix) => key.includes(prefix)),
        undefined,
        { revalidate: true }
      ).catch(() => undefined);
    };

    window.addEventListener(PROJECT_GRAPH_INVALIDATION_EVENT, handleInvalidation);
    return () => window.removeEventListener(PROJECT_GRAPH_INVALIDATION_EVENT, handleInvalidation);
  }, [mutate]);
}
