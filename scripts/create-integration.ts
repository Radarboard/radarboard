/**
 * Scaffold a new integration from the _template directory.
 *
 * Usage: pnpm create-integration <name>
 *   e.g. pnpm create-integration stripe
 *
 * This will:
 *   1. Copy integrations/_template/ into integrations/<name>/
 *   2. Replace all placeholder tokens with the correct casing variants
 *   3. Add the integration to radarboard.config.ts
 *   4. Run pnpm generate:extensions to regenerate init files
 *   5. Print next steps
 */

import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addToConfig, ROOT } from "./lib/config-editor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INTEGRATIONS_DIR = join(ROOT, "integrations");
const TEMPLATE_DIR = join(INTEGRATIONS_DIR, "_template");

function toKebab(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function toCamel(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascal(kebab: string): string {
  const camel = toCamel(kebab);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function toDisplayName(kebab: string): string {
  return kebab
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function replaceTokens(content: string, kebab: string): string {
  return content
    .replace(/__INTEGRATION_KEBAB__/g, kebab)
    .replace(/__INTEGRATION_CAMEL__/g, toCamel(kebab))
    .replace(/__INTEGRATION_PASCAL__/g, toPascal(kebab))
    .replace(/__INTEGRATION_NAME__/g, toDisplayName(kebab));
}

function processDir(dir: string, kebab: string) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      processDir(fullPath, kebab);
    } else {
      // Replace tokens in file content
      const content = readFileSync(fullPath, "utf-8");
      writeFileSync(fullPath, replaceTokens(content, kebab));
    }
  }
}

// --- Main ---

const name = process.argv[2];

if (!name) {
  console.error("Usage: pnpm create-integration <name>");
  console.error("  e.g. pnpm create-integration stripe");
  process.exit(1);
}

const kebab = toKebab(name);
const targetDir = join(INTEGRATIONS_DIR, kebab);

if (existsSync(targetDir)) {
  console.error(`Integration "${kebab}" already exists at ${targetDir}`);
  process.exit(1);
}

if (!existsSync(TEMPLATE_DIR)) {
  console.error(`Template directory not found at ${TEMPLATE_DIR}`);
  process.exit(1);
}

// Copy template
cpSync(TEMPLATE_DIR, targetDir, { recursive: true });

// Process all files
processDir(targetDir, kebab);

// Add to radarboard.config.ts
const added = addToConfig("integration", kebab);
console.log(added ? `  Added @radarboard/integration-${kebab} to radarboard.config.ts` : "  (already present)");

// Regenerate extension init files
console.log("\nRunning pnpm generate:extensions...");
try {
  execSync("pnpm generate:extensions", { cwd: ROOT, stdio: "inherit" });
} catch {
  console.warn("Warning: pnpm generate:extensions failed. You may need to run it manually.");
}

// Install to link the new workspace
console.log("\nRunning pnpm install...");
try {
  execSync("pnpm install", { cwd: ROOT, stdio: "inherit" });
} catch {
  console.warn("Warning: pnpm install failed. Run it manually.");
}

// Print summary
const camel = toCamel(kebab);

console.log(`\nIntegration "${kebab}" created at:`);
console.log(`  ${targetDir}/\n`);
console.log("Files created:");
console.log("  package.json");
console.log("  tsconfig.json");
console.log("  src/index.ts            — Integration descriptor");
console.log("  src/types.ts            — Integration-specific types");
console.log("  src/api/client.ts       — API client");
console.log("  src/api/data-sources.ts — Data source definitions");
console.log("  src/mcp/mcp-tools.ts    — MCP tool definitions");
console.log("  src/conformance.test.ts — Conformance tests");
console.log("\nAuto-wired:");
console.log("  ✓ Added to radarboard.config.ts");
console.log("  ✓ Regenerated init files");
console.log("  ✓ Installed workspace package");
console.log("\nNext steps:");
console.log("  1. Implement the API client in src/api/client.ts");
console.log("  2. Configure auth fields in src/index.ts");
console.log("  3. Wire up data sources in src/api/data-sources.ts");
console.log("  4. Add MCP tools in src/mcp/mcp-tools.ts");
console.log("  5. Run `pnpm check:extensions` to verify quality");
console.log("  6. Run `pnpm test` to verify conformance tests pass\n");
