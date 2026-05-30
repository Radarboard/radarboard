import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDmgPaths } from "./build-dmg.mjs";
import { validateMacOsBundle } from "./validate-macos-bundle.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = resolve(__dirname, "..");

export function timestampForBackup(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function withBackupSuffix(targetPath, timestamp) {
  return `${targetPath}.backup-${timestamp}`;
}

export function resolveFreshInstallTargets({
  appName = "Radarboard.app",
  installDir = "/Applications",
  homeDir = process.env.HOME ?? "",
} = {}) {
  const appSupportDir = resolve(homeDir, "Library", "Application Support");
  return {
    appInstallPath: resolve(installDir, appName),
    dataPaths: [
      resolve(appSupportDir, "Radarboard"),
      resolve(appSupportDir, "com.radarboard.client"),
    ],
  };
}

function backupPathIfPresent(targetPath, timestamp) {
  if (!existsSync(targetPath)) return null;
  const backupPath = withBackupSuffix(targetPath, timestamp);
  renameSync(targetPath, backupPath);
  return backupPath;
}

function resetPath(targetPath, timestamp) {
  const backupPath = backupPathIfPresent(targetPath, timestamp);
  rmSync(targetPath, { recursive: true, force: true });
  return backupPath;
}

export function installBuiltApp({ builtAppPath, appInstallPath, timestamp }) {
  if (!existsSync(builtAppPath)) {
    throw new Error(`Built app bundle not found: ${builtAppPath}`);
  }

  mkdirSync(dirname(appInstallPath), { recursive: true });
  const backupPath = resetPath(appInstallPath, timestamp);
  cpSync(builtAppPath, appInstallPath, { recursive: true });
  return backupPath;
}

export function resetRadarboardData({ dataPaths, timestamp }) {
  return dataPaths.map((targetPath) => ({
    targetPath,
    backupPath: resetPath(targetPath, timestamp),
  }));
}

export function runFreshInstall() {
  const build = spawnSync("pnpm", ["run", "build:desktop"], {
    cwd: DESKTOP_ROOT,
    env: process.env,
    stdio: "inherit",
  });

  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }

  const { appPath: builtAppPath } = resolveDmgPaths();
  validateMacOsBundle({ appPath: builtAppPath });
  const timestamp = timestampForBackup();
  const targets = resolveFreshInstallTargets();

  const appBackupPath = installBuiltApp({
    builtAppPath,
    appInstallPath: targets.appInstallPath,
    timestamp,
  });
  const dataResets = resetRadarboardData({
    dataPaths: targets.dataPaths,
    timestamp,
  });

  console.log(`[build-desktop:fresh-install] Installed ${targets.appInstallPath}`);
  if (appBackupPath) {
    console.log(`[build-desktop:fresh-install] Backed up previous app to ${appBackupPath}`);
  }

  for (const reset of dataResets) {
    if (reset.backupPath) {
      console.log(
        `[build-desktop:fresh-install] Backed up ${reset.targetPath} to ${reset.backupPath}`
      );
    } else {
      console.log(`[build-desktop:fresh-install] No existing data at ${reset.targetPath}`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    runFreshInstall();
  } catch (error) {
    console.error(
      `[build-desktop:fresh-install] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}
