/**
 * Build script for Cloudflare Workers deployment.
 *
 * Produces a single self-contained dist/cloudflare/worker.js targeting the
 * Workers runtime (no Node.js APIs). All dependencies are bundled inline.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");

await build({
  entryPoints: [resolve(packageRoot, "src/cloudflare-entry.ts")],
  bundle: true,
  platform: "node",
  target: "es2022",
  format: "esm",
  outfile: resolve(packageRoot, "dist/cloudflare/worker.js"),
  // Node built-ins are available via Workers nodejs_compat flag.
  external: ["node:*"],
  // Resolve workspace package exports
  conditions: ["import", "worker", "default"],
  resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
});

console.log("✓ Built dist/cloudflare/worker.js (Cloudflare Workers)");
