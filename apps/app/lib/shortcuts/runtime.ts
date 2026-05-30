"use client";

import type { AppShortcutActionId } from "@radarboard/types/shortcuts";

export type ShortcutRuntimeEvent =
  | { kind: "app"; actionId: AppShortcutActionId }
  | { kind: "plugin"; pluginId: string };

const SHORTCUT_EVENT_NAME = "radarboard:shortcut-action";

export function dispatchShortcutRuntimeEvent(detail: ShortcutRuntimeEvent): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ShortcutRuntimeEvent>(SHORTCUT_EVENT_NAME, { detail }));
}

export function addShortcutRuntimeListener(
  listener: (event: ShortcutRuntimeEvent) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ShortcutRuntimeEvent>;
    listener(customEvent.detail);
  };

  window.addEventListener(SHORTCUT_EVENT_NAME, handler);
  return () => window.removeEventListener(SHORTCUT_EVENT_NAME, handler);
}
