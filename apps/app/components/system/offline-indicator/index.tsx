"use client";

import { WifiOff } from "lucide-react";
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";

function subscribeToOnlineStatus(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {
      // Server render fallback: no-op unsubscribe.
    };
  }

  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * A subtle indicator that appears when the browser is offline.
 */
export function OfflineIndicator() {
  const isOnline = useSyncExternalStore(subscribeToOnlineStatus, getOnlineSnapshot, () => true);
  const reduceMotion = useReducedMotion();
  const isOffline = !isOnline;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOffline && (
          <m.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-4 left-4 z-[100] flex items-center gap-2 rounded-item border border-warning bg-surface-raised px-3 py-2 text-warning shadow-lg"
          >
            <WifiOff className="icon-sm" />
            <span className="font-medium text-w-base">Offline Mode</span>
            <span className="ml-1 text-dim text-w-sm">— viewing cached data</span>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
