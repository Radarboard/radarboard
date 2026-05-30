import { join } from "node:path";
import { getWebBooleanEnv, getWebEnv } from "./env";

const DEFAULT_DATA_DIR = ".radarboard-data";
const E2E_CONFIG_FILENAME = ".radarboard.e2e.json";
const DEFAULT_CONFIG_FILENAME = ".radarboard.json";
const E2E_SQLITE_FILENAME = "local.e2e.db";
const DEFAULT_SQLITE_FILENAME = "local.db";

function isRuntimeE2EMode(): boolean {
  return getWebBooleanEnv("RADARBOARD_E2E");
}

export function getRuntimeConfigFilename(): string {
  return isRuntimeE2EMode() ? E2E_CONFIG_FILENAME : DEFAULT_CONFIG_FILENAME;
}

export function getRuntimeSqliteFilename(): string {
  return isRuntimeE2EMode() ? E2E_SQLITE_FILENAME : DEFAULT_SQLITE_FILENAME;
}

export function getRadarboardDataDir(): string {
  return getWebEnv("RADARBOARD_DATA_DIR") ?? join(process.cwd(), DEFAULT_DATA_DIR);
}

export function getRuntimeConfigPath(): string {
  return join(getRadarboardDataDir(), getRuntimeConfigFilename());
}

export function getSqliteUrl(): string {
  return `file:${join(getRadarboardDataDir(), getRuntimeSqliteFilename())}`;
}
