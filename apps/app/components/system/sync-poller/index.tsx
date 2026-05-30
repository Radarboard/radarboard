"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { clearSyncAction, getSyncQueue } from "@/lib/offline-sync";

/**
 * Background poller that watches for connection status and syncs the queue.
 */
export function SyncPoller() {
  const [_isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (isSyncingRef.current) return;

    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    let successCount = 0;

    for (const action of queue) {
      try {
        const res = await fetch(API_ROUTES.settings, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.payload),
        });

        if (!res.ok) {
          throw new Error(`Sync failed with status ${res.status}`);
        }

        await clearSyncAction(action.id);
        successCount++;
      } catch (_error) {
        // Stop processing if we're still offline or hit an error
        if (typeof navigator !== "undefined" && !navigator.onLine) break;
      }
    }

    if (successCount > 0) {
      toast.success(`Synced ${successCount} offline actions`);
    }

    isSyncingRef.current = false;
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      processQueue();
    };

    window.addEventListener("online", handleOnline);

    // Also check on mount if we are already online
    if (navigator.onLine) {
      processQueue();
    }

    return () => window.removeEventListener("online", handleOnline);
  }, [processQueue]);

  return null;
}
