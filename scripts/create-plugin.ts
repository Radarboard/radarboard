/**
 * Scaffold a new plugin from the _template directory.
 *
 * Usage: pnpm create-plugin <name>
 *   e.g. pnpm create-plugin calendar
 *
 * This will:
 *   1. Copy plugins/_template/ into plugins/<name>/
 *   2. Replace all placeholder tokens with the correct casing variants
 *   3. Rename files containing __PLUGIN_KEBAB__ in their name
 *   4. Auto-add the entry to radarboard.config.ts
 *   5. Run pnpm generate:extensions
 *   6. Print a summary of created files and next steps
 */

import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { addToConfig, ROOT } from "./lib/config-editor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = ROOT;
const PLUGINS_DIR = resolve(ROOT_DIR, "plugins");
const TEMPLATE_DIR = join(PLUGINS_DIR, "_template");

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
    .replace(/__PLUGIN_KEBAB__/g, kebab)
    .replace(/__PLUGIN_CAMEL__/g, toCamel(kebab))
    .replace(/__PLUGIN_PASCAL__/g, toPascal(kebab))
    .replace(/__PLUGIN_NAME__/g, toDisplayName(kebab));
}

function processDir(dir: string, kebab: string, createdFiles: string[]) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      processDir(fullPath, kebab, createdFiles);
    } else {
      // Replace tokens in file content
      const content = readFileSync(fullPath, "utf-8");
      writeFileSync(fullPath, replaceTokens(content, kebab));

      // Rename file if it contains the placeholder
      let finalPath = fullPath;
      if (entry.includes("__PLUGIN_KEBAB__")) {
        const newName = entry.replace(/__PLUGIN_KEBAB__/g, kebab);
        finalPath = join(dir, newName);
        renameSync(fullPath, finalPath);
      }

      createdFiles.push(finalPath);
    }
  }
}

// --- Main ---

const name = process.argv[2];

if (!name) {
  console.error("Usage: pnpm create-plugin <name>");
  console.error("  e.g. pnpm create-plugin calendar");
  process.exit(1);
}

const kebab = toKebab(name);
const targetDir = join(PLUGINS_DIR, kebab);

if (existsSync(targetDir)) {
  console.error(`Plugin "${kebab}" already exists at ${targetDir}`);
  process.exit(1);
}

if (!existsSync(TEMPLATE_DIR)) {
  console.error(`Template directory not found at ${TEMPLATE_DIR}`);
  process.exit(1);
}

// Copy template
cpSync(TEMPLATE_DIR, targetDir, { recursive: true });

// Process all files
const createdFiles: string[] = [];
processDir(targetDir, kebab, createdFiles);

// Add to radarboard.config.ts
console.log("\nUpdating radarboard.config.ts...");
const added = addToConfig("plugin", kebab);
console.log(added ? `  Added @radarboard/plugin-${kebab} to radarboard.config.ts` : "  (already present)");

// Run generate:extensions
console.log("\nRunning pnpm generate:extensions...");
try {
  execSync("pnpm generate:extensions", { cwd: ROOT_DIR, stdio: "inherit" });
} catch {
  console.warn("  Warning: generate:extensions failed. You may need to run it manually.");
}

// Install to link the new workspace
console.log("\nRunning pnpm install...");
try {
  execSync("pnpm install", { cwd: ROOT_DIR, stdio: "inherit" });
} catch {
  console.warn("  Warning: pnpm install failed. Run it manually.");
}

// Print summary
const camel = toCamel(kebab);
const pascal = toPascal(kebab);
const relativeFiles = createdFiles.map((f) => f.replace(`${targetDir}/`, ""));

console.log(`\nPlugin "${kebab}" created at:`);
console.log(`  ${targetDir}/\n`);
console.log("Files created:");
for (const file of relativeFiles) {
  console.log(`  ${file}`);
}
console.log("\nAuto-wired:");
console.log("  ✓ Added to radarboard.config.ts");
console.log("  ✓ Regenerated init files");
console.log("  ✓ Installed workspace package");
console.log("\nNext steps:");
console.log(`  1. Implement the overlay component in src/components/${kebab}-overlay.tsx`);
console.log("  2. Add MCP tools in src/mcp-tools.ts");
console.log("  3. Update the descriptor settings in src/index.ts");
console.log("  4. Replace the default Puzzle icon with an appropriate one");
console.log("  5. Run `pnpm check:extensions` to verify quality");
console.log("  6. Run `pnpm test` to verify conformance tests pass\n");
