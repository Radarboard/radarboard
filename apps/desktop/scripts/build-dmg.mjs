import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateMacOsBundle } from "./validate-macos-bundle.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = resolve(__dirname, "..");
const DEFAULT_CONFIG_PATH = resolve(DESKTOP_ROOT, "src-tauri", "tauri.conf.json");

export function resolveBundleArch(arch = process.arch) {
  switch (arch) {
    case "arm64":
      return "aarch64";
    case "x64":
      return "x86_64";
    default:
      return arch;
  }
}

export function readTauriConfig(configPath = DEFAULT_CONFIG_PATH) {
  return JSON.parse(readFileSync(configPath, "utf8"));
}

export function resolveDmgPaths(configPath = DEFAULT_CONFIG_PATH, arch = process.arch) {
  const config = readTauriConfig(configPath);
  const srcTauriDir = dirname(configPath);
  const releaseBundleDir = join(srcTauriDir, "target", "release", "bundle");
  const dmgDir = join(releaseBundleDir, "dmg");
  const macosDir = join(releaseBundleDir, "macos");
  const productName = config.productName;
  const version = config.version;
  const bundleArch = resolveBundleArch(arch);

  return {
    appPath: join(macosDir, `${productName}.app`),
    config,
    configPath,
    dmgDir,
    dmgPath: join(dmgDir, `${productName}_${version}_${bundleArch}.dmg`),
    macosDir,
    productName,
    releaseBundleDir,
    version,
  };
}

export function buildHdiutilArgs({ appName, dmgPath, sourceDir }) {
  return [
    "create",
    "-volname",
    appName,
    "-srcfolder",
    sourceDir,
    "-ov",
    "-format",
    "UDZO",
    dmgPath,
  ];
}

export function createDmg(options = {}) {
  const { appPath, dmgDir, dmgPath, productName } = resolveDmgPaths(
    options.configPath,
    options.arch
  );

  if (!existsSync(appPath)) {
    throw new Error(`App bundle not found for DMG packaging: ${appPath}`);
  }

  const sourceDir = mkdtempSync(join(tmpdir(), "radarboard-dmg-"));

  try {
    cpSync(appPath, join(sourceDir, `${productName}.app`), { recursive: true });
    symlinkSync("/Applications", join(sourceDir, "Applications"));
    validateMacOsBundle({
      appPath: join(sourceDir, `${productName}.app`),
      sourceDir,
      productName,
    });
    rmSync(dmgPath, { force: true });

    const args = buildHdiutilArgs({
      appName: productName,
      dmgPath,
      sourceDir,
    });

    const result = spawnSync("hdiutil", args, {
      cwd: dmgDir,
      env: process.env,
      stdio: "inherit",
    });

    if (result.status !== 0) {
      throw new Error(`DMG packaging failed with exit code ${result.status ?? 1}`);
    }

    return dmgPath;
  } finally {
    rmSync(sourceDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const dmgPath = createDmg();
    console.log(`[build-dmg] Created ${dmgPath}`);
  } catch (error) {
    console.error(`[build-dmg] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
