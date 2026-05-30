import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const desktopPackagePath = path.join(rootDir, "apps", "desktop", "package.json");
const tauriConfigPath = path.join(rootDir, "apps", "desktop", "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(rootDir, "apps", "desktop", "src-tauri", "Cargo.toml");

type VersionedJson = {
  version?: string;
};

function incrementPatch(version: string): string {
  const match = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/.exec(version);

  if (!match?.groups) {
    throw new Error(`Unsupported desktop version format: ${version}`);
  }

  const major = Number(match.groups.major);
  const minor = Number(match.groups.minor);
  const patch = Number(match.groups.patch);

  return `${major}.${minor}.${patch + 1}`;
}

function readJson(filePath: string): VersionedJson {
  return JSON.parse(readFileSync(filePath, "utf8")) as VersionedJson;
}

function writeJson(filePath: string, value: VersionedJson) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function replaceCargoVersion(contents: string, nextVersion: string): string {
  const updated = contents.replace(/^version = "([^"]+)"$/m, `version = "${nextVersion}"`);

  if (updated === contents) {
    throw new Error(`Failed to update Cargo version in ${cargoTomlPath}`);
  }

  return updated;
}

function main() {
  const desktopPackage = readJson(desktopPackagePath);
  const tauriConfig = readJson(tauriConfigPath);

  if (!desktopPackage.version || !tauriConfig.version) {
    throw new Error("Desktop package.json and tauri.conf.json must both declare a version");
  }

  if (desktopPackage.version !== tauriConfig.version) {
    throw new Error(
      `Desktop version mismatch before bump: package.json=${desktopPackage.version}, tauri.conf.json=${tauriConfig.version}`
    );
  }

  const cargoToml = readFileSync(cargoTomlPath, "utf8");
  const cargoVersionMatch = /^version = "([^"]+)"$/m.exec(cargoToml);

  if (!cargoVersionMatch?.[1]) {
    throw new Error(`Missing Cargo version in ${cargoTomlPath}`);
  }

  if (cargoVersionMatch[1] !== desktopPackage.version) {
    throw new Error(
      `Desktop version mismatch before bump: Cargo.toml=${cargoVersionMatch[1]}, package.json=${desktopPackage.version}`
    );
  }

  const nextVersion = incrementPatch(desktopPackage.version);

  desktopPackage.version = nextVersion;
  tauriConfig.version = nextVersion;

  writeJson(desktopPackagePath, desktopPackage);
  writeJson(tauriConfigPath, tauriConfig);
  writeFileSync(cargoTomlPath, replaceCargoVersion(cargoToml, nextVersion));

  console.log(`bumped desktop release version to ${nextVersion}`);
}

main();
