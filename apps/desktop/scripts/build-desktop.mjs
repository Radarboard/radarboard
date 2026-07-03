import { spawnSync } from "node:child_process";
import { createDmg, resolveDmgPaths } from "./build-dmg.mjs";
import { validateMacOsBundle } from "./validate-macos-bundle.mjs";

// The config sets `bundle.createUpdaterArtifacts: true`, which makes `tauri
// build` sign the updater `.tar.gz` and fail if no signing key is present.
// Local builds don't need signed updater artifacts, so skip generating them
// unless a signing key is available. CI/release builds set
// TAURI_SIGNING_PRIVATE_KEY and keep producing signed artifacts.
const tauriConfigArgs = ["--config", "src-tauri/tauri.conf.json"];
if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
  console.log(
    "[build-desktop] TAURI_SIGNING_PRIVATE_KEY not set — skipping updater artifacts for this build."
  );
  tauriConfigArgs.push("--config", JSON.stringify({ bundle: { createUpdaterArtifacts: false } }));
}

const tauriBuild = spawnSync(
  "pnpm",
  ["exec", "tauri", "build", ...tauriConfigArgs, "--bundles", "app"],
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
