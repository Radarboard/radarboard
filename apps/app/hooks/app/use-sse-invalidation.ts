"use client";

import { eventStreamRoute } from "@radarboard/types/api-routes";
import { useEffect, useRef } from "react";
import { useSWRConfig } from "swr";

/**
 * Hook that subscribes to the SSE event gateway's invalidation channel
 * and triggers SWR revalidation when cache invalidation events arrive.
 *
 * Usage: call once at the app root (e.g., in providers.tsx).
 */
export function useSSEInvalidation() {
  const { mutate } = useSWRConfig();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(eventStreamRoute(["invalidation"]));
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as {
          type?: string;
          data?: { prefixes?: string[]; source?: string };
        };

        if (parsed.type === "cache:invalidate" && parsed.data?.prefixes) {
          // Revalidate all SWR keys that match any of the invalidated prefixes
          mutate(
            (key) => {
              if (typeof key !== "string") return false;
              return parsed.data?.prefixes?.some((prefix) => key.includes(prefix));
            },
            undefined,
            { revalidate: true }
          );
        }
      } catch {
        // Ignore malformed events (e.g., the initial "connected" event)
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects — no action needed
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [mutate]);
}
