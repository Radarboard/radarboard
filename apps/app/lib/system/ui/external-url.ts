"use client";

import type { MouseEvent } from "react";
import { isTauri } from "@/lib/platform";

export async function openExternalUrl(url: string): Promise<void> {
  if (typeof window === "undefined") return;

  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_external_url", { url });
      return;
    } catch {
      // Fall through to browser behavior below as a last resort.
    }
  }

  try {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  } catch {
    // Ignore failures in environments that block popups.
  }
}

export function handleExternalLinkClick(event: MouseEvent<HTMLAnchorElement>, url: string): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  event.preventDefault();
  openExternalUrl(url).catch(() => {
    // Ignore opener failures and keep the click non-fatal.
  });
}
