"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { ProjectContext, ProjectContextMap } from "@radarboard/types/project-context";
import { emptyProjectContext } from "@radarboard/types/project-context";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook to load and persist per-project context (goals, priorities, notes, stage).
 * Auto-saves with debounce when context changes.
 */
export function useProjectContext() {
  const [contextMap, setContextMap] = useState<ProjectContextMap>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on mount from the existing settings endpoint
  useEffect(() => {
    fetch(API_ROUTES.settings)
      .then((res) => res.json())
      .then((data: { projectContextMap?: ProjectContextMap }) => {
        if (data.projectContextMap) {
          setContextMap(data.projectContextMap);
        }
        setIsLoaded(true);
      })
      .catch(() => {
        setIsLoaded(true);
      });
  }, []);

  // Debounced save via the existing settings endpoint
  const save = useCallback((map: ProjectContextMap) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch(API_ROUTES.settings, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectContextMap: map }),
      }).catch(() => {
        // Non-critical — settings save failure
      });
    }, 500);
  }, []);

  const getContext = useCallback(
    (projectSlug: string): ProjectContext => {
      return contextMap[projectSlug] ?? emptyProjectContext();
    },
    [contextMap]
  );

  const updateContext = useCallback(
    (projectSlug: string, ctx: ProjectContext) => {
      const next = { ...contextMap, [projectSlug]: ctx };
      setContextMap(next);
      save(next);
    },
    [contextMap, save]
  );

  return { contextMap, getContext, updateContext, isLoaded };
}
