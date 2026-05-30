"use client";

import { useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook to provide native OS notifications when running in Tauri,
 * falling back to web toasts.
 */
export function useNativeNotifications() {
  const notify = useCallback(async (title: string, body?: string) => {
    const { isTauri } = await import("@/lib/platform");

    if (isTauri()) {
      try {
        const { isPermissionGranted, requestPermission, sendNotification } = await import(
          "@tauri-apps/plugin-notification"
        );

        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === "granted";
        }

        if (permissionGranted) {
          sendNotification({ title, body });
          return;
        }
      } catch (_err) {
        // Fall back to a toast if the native notification bridge is unavailable.
      }
    }

    // Fallback to toast
    toast(title, { description: body });
  }, []);

  return { notify };
}
