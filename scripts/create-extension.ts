#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_COMMUNITY_ROOT = resolve(ROOT, "..", "community-extensions");
const communityRoot = process.env.RADARBOARD_COMMUNITY_EXTENSIONS_DIR
  ? resolve(process.env.RADARBOARD_COMMUNITY_EXTENSIONS_DIR)
  : DEFAULT_COMMUNITY_ROOT;

if (!existsSync(`${communityRoot}/package.json`)) {
  console.error(`Community extensions repo not found at ${communityRoot}`);
  console.error("Set RADARBOARD_COMMUNITY_EXTENSIONS_DIR to the community-extensions checkout.");
  process.exit(1);
}

const result = spawnSync("pnpm", ["create-extension", ...process.argv.slice(2)], {
  cwd: communityRoot,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
