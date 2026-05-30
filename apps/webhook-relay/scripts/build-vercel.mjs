/**
 * Build script for Vercel deployment using the Build Output API v3.
 *
 * Generates .vercel/output/ directly, bypassing all Vercel framework
 * detection and @vercel/node builder logic. This is necessary because:
 *
 * 1. @vercel/hono auto-detection traces src/index.ts and hits workspace
 *    .ts imports that Node.js cannot execute at runtime.
 * 2. framework: null disables serverless function discovery entirely.
 * 3. The Build Output API gives us full control over what gets deployed.
 *
 * All dependencies (including npm packages) are bundled into a single
 * self-contained file — no node_modules resolution at runtime.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const outputDir = resolve(packageRoot, ".vercel/output");
const funcDir = resolve(outputDir, "functions/api/index.func");

// Bundle everything into a single self-contained file.
// No external dependencies — no node_modules resolution at runtime.
await build({
  entryPoints: [resolve(packageRoot, "src/vercel-entry.ts")],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  outfile: resolve(funcDir, "index.js"),
  // Only Node.js built-ins are external — everything else is inlined.
  external: ["node:*"],
  // Resolve workspace package exports
  conditions: ["import", "default"],
  resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
});

// .vc-config.json tells Vercel how to run this function.
writeFileSync(
  resolve(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs24.x",
      handler: "index.js",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
    },
    null,
    2
  )
);

// config.json defines routes — catch-all to the single function.
mkdirSync(resolve(outputDir, "static"), { recursive: true });
writeFileSync(
  resolve(outputDir, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [{ src: "/(.*)", dest: "/api" }],
    },
    null,
    2
  )
);

console.log("✓ Built .vercel/output/ (Build Output API v3)");
