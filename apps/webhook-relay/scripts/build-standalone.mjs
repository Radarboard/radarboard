/**
 * Build script for standalone Node.js deployment (Railway, Fly.io, Render, Docker, etc.).
 *
 * Produces a single self-contained dist/server.js that can be run with `node dist/server.js`.
 * All dependencies (including npm packages) are bundled inline — no node_modules at runtime.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");

await build({
  entryPoints: [resolve(packageRoot, "src/server.ts")],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: resolve(packageRoot, "dist/server.js"),
  // Only Node.js built-ins are external — everything else is inlined.
  external: ["node:*"],
  // Resolve workspace package exports
  conditions: ["import", "default"],
  resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
  banner: {
    // @hono/node-server uses require() for optional deps — provide a shim in ESM context.
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
});

console.log("✓ Built dist/server.js (standalone Node.js)");
