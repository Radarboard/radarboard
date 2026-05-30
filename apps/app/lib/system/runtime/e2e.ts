import { getWebBooleanEnv } from "./env";

const E2E_CONFIG_FILENAME = ".radarboard.e2e.json";
const DEFAULT_CONFIG_FILENAME = ".radarboard.json";

const E2E_SQLITE_FILENAME = "local.e2e.db";
const DEFAULT_SQLITE_FILENAME = "local.db";

const E2E_DATASET_KEY = "radarboardE2e";

export function isE2EMode(): boolean {
  return getWebBooleanEnv("RADARBOARD_E2E");
}

export function isClientE2EMode(): boolean {
  if (typeof document !== "undefined") {
    return document.documentElement.dataset[E2E_DATASET_KEY] === "1";
  }

  return getWebBooleanEnv("NEXT_PUBLIC_RADARBOARD_E2E");
}

export function setClientE2EModeMarker(enabled: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset[E2E_DATASET_KEY] = enabled ? "1" : "0";
}

export function getRadarboardConfigFilename(): string {
  return isE2EMode() ? E2E_CONFIG_FILENAME : DEFAULT_CONFIG_FILENAME;
}

export function getSqliteFilename(): string {
  return isE2EMode() ? E2E_SQLITE_FILENAME : DEFAULT_SQLITE_FILENAME;
}
