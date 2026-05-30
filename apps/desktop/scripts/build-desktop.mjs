import { spawnSync } from "node:child_process";
import { createDmg, resolveDmgPaths } from "./build-dmg.mjs";
import { validateMacOsBundle } from "./validate-macos-bundle.mjs";

const tauriBuild = spawnSync(
  "pnpm",
  ["exec", "tauri", "build", "--config", "src-tauri/tauri.conf.json", "--bundles", "app"],
  {
    env: process.env,
    stdio: "inherit",
  }
);

if (tauriBuild.status !== 0) {
  process.exit(tauriBuild.status ?? 1);
}

try {
  const { appPath } = resolveDmgPaths();
  validateMacOsBundle({ appPath });
  const dmgPath = createDmg();
  console.log(`[build-desktop] DMG created at ${dmgPath}`);
} catch (error) {
  console.error(`[build-desktop] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
