/**
 * Scaffold a new widget from the _template directory.
 *
 * Usage: pnpm create-widget <name>
 *   e.g. pnpm create-widget github-releases
 *
 * This will:
 *   1. Copy _template/ into widgets/<name>/src/
 *   2. Replace all placeholder tokens with the correct casing variants
 *   3. Rename files containing __WIDGET_KEBAB__ in their name
 *   4. Add the widget to radarboard.config.ts
 *   5. Run pnpm generate:extensions to regenerate init files
 *   6. Run pnpm install to link the new workspace package
 *   7. Print next steps
 */

import { cpSync, existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addToConfig, ROOT } from "./lib/config-editor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WIDGETS_DIR = join(ROOT, "widgets");
const TEMPLATE_DIR = join(WIDGETS_DIR, "_template");

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
    .replace(/__WIDGET_KEBAB__/g, kebab)
    .replace(/__WIDGET_CAMEL__/g, toCamel(kebab))
    .replace(/__WIDGET_PASCAL__/g, toPascal(kebab))
    .replace(/__WIDGET_NAME__/g, toDisplayName(kebab));
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

      // Rename file if it contains the placeholder
      if (entry.includes("__WIDGET_KEBAB__")) {
        const newName = entry.replace(/__WIDGET_KEBAB__/g, kebab);
        renameSync(fullPath, join(dir, newName));
      }
    }
  }
}

// --- Main ---

const name = process.argv[2];

if (!name) {
  console.error("Usage: pnpm create-widget <name>");
  console.error("  e.g. pnpm create-widget github-releases");
  process.exit(1);
}

const kebab = toKebab(name);
const targetDir = join(WIDGETS_DIR, kebab);

if (existsSync(targetDir)) {
  console.error(`Widget "${kebab}" already exists at ${targetDir}`);
  process.exit(1);
}

if (!existsSync(TEMPLATE_DIR)) {
  console.error(`Template directory not found at ${TEMPLATE_DIR}`);
  process.exit(1);
}

// Create package structure
const srcDir = join(targetDir, "src");
cpSync(TEMPLATE_DIR, srcDir, { recursive: true });

// Create package.json for the new widget
const pkgJson = {
  name: `@radarboard/widget-${kebab}`,
  version: "1.0.0",
  private: true,
  type: "module",
  exports: {
    ".": "./src/index.tsx",
    "./data-resolver": "./src/data-resolver.tsx",
  },
  scripts: {
    test: "vitest run",
    typecheck: "tsc --noEmit",
  },
  dependencies: {
    "@radarboard/widget-engine": "workspace:*",
    "@radarboard/widget-sdk": "workspace:*",
    "@radarboard/charts": "workspace:*",
    "@radarboard/types": "workspace:*",
    "@radarboard/ui": "workspace:*",
    "@radarboard/utils": "workspace:*",
    "@radarboard/hooks": "workspace:*",
    "react": "catalog:",
    "lucide-react": "catalog:",
    "swr": "catalog:",
  },
  devDependencies: {
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
  },
};

writeFileSync(join(targetDir, "package.json"), `${JSON.stringify(pkgJson, null, 2)}\n`);

// Process all files in src
processDir(srcDir, kebab);

// Add to radarboard.config.ts
console.log("\nUpdating radarboard.config.ts...");
const added = addToConfig("widget", kebab);
console.log(added ? `  Added @radarboard/widget-${kebab} to radarboard.config.ts` : "  (already present)");

// Regenerate extension init files (includes transpile-packages.ts)
console.log("\nRunning pnpm generate:extensions...");
try {
  execSync("pnpm generate:extensions", { cwd: ROOT, stdio: "inherit" });
} catch {
  console.warn("  Warning: generate:extensions failed. You may need to run it manually.");
}

// Install to link the new workspace
console.log("\nRunning pnpm install...");
try {
  execSync("pnpm install", { cwd: ROOT, stdio: "inherit" });
} catch {
  console.warn("  Warning: pnpm install failed. Run it manually.");
}

// Print summary
const camel = toCamel(kebab);

console.log(`\nWidget "${kebab}" created at:`);
console.log(`  ${targetDir}/\n`);
console.log("Files created:");
console.log("  package.json              — Package definition");
console.log("  src/types.ts              — Widget-specific types");
console.log("  src/index.ts              — Widget descriptor");
console.log("  src/routes.ts             — Widget API route constants");
console.log("  src/data-resolver.tsx      — Self-registering data resolver");
console.log("  src/conformance.test.ts    — Conformance tests");
console.log(`  src/hooks/use-${kebab}.ts — Data-fetching hook`);
console.log(`  src/components/${kebab}-compact.tsx`);
console.log(`  src/components/${kebab}-expanded.tsx`);
console.log("  src/mcp/mcp-tools.ts");
console.log("\nAuto-wired:");
console.log("  ✓ Added to radarboard.config.ts");
console.log("  ✓ Regenerated init files (including transpile-packages.ts)");
console.log("  ✓ Installed workspace package");
console.log("\nNext steps:");
console.log("  1. Implement the data resolver in src/data-resolver.tsx");
console.log("  2. Build compact + expanded views in src/components/");
console.log(`  3. Configure the descriptor in src/index.ts`);
console.log("  4. Run `pnpm check:extensions` to verify quality");
console.log("  5. Run `pnpm test` to verify conformance tests pass\n");
