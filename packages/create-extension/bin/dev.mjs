#!/usr/bin/env node

/**
 * radarboard-extension dev
 *
 * Starts an isolated dev server for a single extension, with hot reload.
 * Detects the extension type from radarboard-extension.json or package.json
 * and launches the appropriate sandbox page.
 *
 * Usage:
 *   npx radarboard-extension dev
 *   npx radarboard-extension dev --port 1366
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const args = process.argv.slice(2);
const portIdx = args.indexOf("--port");
const port = portIdx !== -1 ? args[portIdx + 1] : "1355";

// ---------------------------------------------------------------------------
// Detect extension type
// ---------------------------------------------------------------------------

function detectExtensionType() {
  // Check radarboard-extension.json first
  const manifestPath = join(cwd, "radarboard-extension.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const types = manifest.extensions?.map((e) => e.type) ?? [];
    return types;
  }

  // Fallback: check package.json name
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const name = pkg.name ?? "";
    if (name.includes("integration")) return ["integration"];
    if (name.includes("plugin")) return ["plugin"];
    if (name.includes("widget")) return ["widget"];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const types = detectExtensionType();

if (types.length === 0) {
  console.error("Could not detect extension type.");
  console.error(
    "Run this from an extension directory with radarboard-extension.json or a package.json with a @radarboard/* name."
  );
  process.exit(1);
}

const sandboxPaths = {
  widget: "/debug/widget-sandbox",
  plugin: "/debug/plugin-sandbox",
  integration: "/debug/integration-sandbox",
};

const primaryType = types[0];
const sandboxPath = sandboxPaths[primaryType] ?? "/debug/widget-sandbox";

console.log(`\nExtension type: ${types.join(", ")}`);
console.log(`Dev server: http://localhost:${port}${sandboxPath}`);
console.log("\nMake sure the Radarboard dev server is running (pnpm dev).");
console.log("The sandbox will use your extension via the devExtensions config.\n");
console.log("Steps to connect:");
console.log(`  1. Add to radarboard.config.ts devExtensions:`);
console.log(`     { type: "${primaryType}", path: "${cwd}" }`);
console.log(`  2. Run: pnpm generate:extensions`);
console.log(`  3. Open: http://localhost:${port}${sandboxPath}`);
console.log("");

// Open the sandbox URL
const openCmd =
  process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
try {
  execSync(`${openCmd} http://localhost:${port}${sandboxPath}`, { stdio: "ignore" });
} catch {
  // Non-fatal — URL printed above
}
