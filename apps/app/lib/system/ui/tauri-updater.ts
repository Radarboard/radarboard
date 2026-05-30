"use client";

import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";

export type DesktopChannel = "stable" | "dev" | "unknown";

const STABLE_DESKTOP_IDENTIFIER = "com.radarboard.client";

export type DesktopAppInfo = {
  appName: string;
  appVersion: string;
  tauriVersion: string;
  identifier: string;
  channel: DesktopChannel;
  updaterEnabled: boolean;
};

export type DesktopOsInfo = {
  osType: string;
  version: string;
  arch: string;
  locale: string | null;
  hostname: string | null;
};

function getTauriWindow(): Window | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window;
}

export function isDesktopRuntime() {
  const tauriWindow = getTauriWindow();
  const tauriInternals = tauriWindow ? Reflect.get(tauriWindow, "__TAURI_INTERNALS__") : undefined;
  return Boolean(tauriInternals);
}

export function getDesktopChannel(identifier: string): DesktopChannel {
  if (identifier === STABLE_DESKTOP_IDENTIFIER) {
    return "stable";
  }

  if (identifier.endsWith(".dev") || identifier.startsWith(`${STABLE_DESKTOP_IDENTIFIER}.`)) {
    return "dev";
  }

  return "unknown";
}

export function isDesktopUpdaterEnabled(identifier: string) {
  return getDesktopChannel(identifier) === "stable";
}

export async function getDesktopAppInfo(): Promise<DesktopAppInfo> {
  const [{ getIdentifier, getName, getTauriVersion, getVersion }] = await Promise.all([
    import("@tauri-apps/api/app"),
  ]);

  const [appName, appVersion, tauriVersion, identifier] = await Promise.all([
    getName(),
    getVersion(),
    getTauriVersion(),
    getIdentifier(),
  ]);

  return {
    appName,
    appVersion,
    tauriVersion,
    identifier,
    channel: getDesktopChannel(identifier),
    updaterEnabled: isDesktopUpdaterEnabled(identifier),
  };
}

export async function getDesktopOsInfo(): Promise<DesktopOsInfo> {
  const { type, version, arch, locale, hostname } = await import("@tauri-apps/plugin-os");
  const [osType, osVersion, osArch, osLocale, osHostname] = await Promise.all([
    type(),
    version(),
    arch(),
    locale(),
    hostname(),
  ]);
  return { osType, version: osVersion, arch: osArch, locale: osLocale, hostname: osHostname };
}

export async function checkForDesktopUpdate() {
  const { check } = await import("@tauri-apps/plugin-updater");
  return check();
}

export async function installDesktopUpdate(
  update: Update,
  onEvent?: (event: DownloadEvent) => void
) {
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await update.downloadAndInstall(onEvent);
  await relaunch();
}
