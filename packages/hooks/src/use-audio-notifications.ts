"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { NotificationSeverity } from "@radarboard/types/notifications";
import { useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import { apiFetcher } from "./fetcher";
import { useNotificationPreferences } from "./use-notification-preferences";
import { useNotificationStream } from "./use-notification-stream";

export interface SoundDefinition {
  id: string;
  label: string;
  url: string;
}

export const DEFAULT_SOUNDS: Record<NotificationSeverity, string> = {
  critical: "/sounds/error-001.mp3",
  warning: "/sounds/boat-docked-warning.mp3",
  info: "/sounds/notification-pop.mp3",
  success: "/sounds/success-chime.mp3",
};

export function useAvailableSounds() {
  const { data, mutate, isLoading } = useSWR<{ sounds: SoundDefinition[] }>(
    API_ROUTES.notificationSounds,
    apiFetcher
  );

  const downloadSound = useCallback(
    async (soundcnUrl: string) => {
      const res = await fetch(API_ROUTES.notificationSounds, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: soundcnUrl }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to download sound");
      }

      const result = await res.json();
      await mutate();
      return result.sound as SoundDefinition;
    },
    [mutate]
  );

  return {
    sounds: data?.sounds ?? [],
    loading: isLoading,
    downloadSound,
    refetch: mutate,
  };
}

export function playSound(url: string | undefined) {
  if (!url || url === "none" || url === "") return;

  try {
    const audio = new Audio(url);
    audio.play().catch((_err) => {
      // Browsers often block audio play() if there was no user interaction yet.
    });
  } catch (_err) {
    // Silence errors in production.
  }
}

export function useAudioNotifications(enabled = true) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const { preferences } = useNotificationPreferences();
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  const stream = useNotificationStream(enabled);

  useEffect(() => {
    if (!enabled) return;
    const msg = stream.data;
    if (!msg || msg.type !== "event") return;
    if (!enabledRef.current) return;

    // We don't want to play sound if the document is focused and the notification is just "info"
    // to avoid being too noisy while working.
    if (document.hasFocus() && msg.payload.severity === "info") return;

    const sourceId = msg.payload.source;
    const sourcePref = preferencesRef.current.find((p) => p.id === sourceId);
    const globalPref = preferencesRef.current.find((p) => p.id === "global");
    const severity = msg.payload.severity;

    // Resolve URL: Source-specific > Global > Default
    const url =
      sourcePref?.sounds?.[severity] || globalPref?.sounds?.[severity] || DEFAULT_SOUNDS[severity];

    if (url && url !== "none") {
      playSound(url);
    }
  }, [stream.data, enabled]);
}
