#!/usr/bin/env tsx
/**
 * Generate a static JSON catalog of all registered extensions.
 *
 * Reads radarboard.config.ts and each extension's descriptor to produce
 * a browsable catalog at apps/app/public/extension-catalog.json.
 *
 * This file is committed to the repo and updated automatically via
 * the extension-catalog GitHub Actions workflow on merge to main.
 *
 * Usage: pnpm tsx scripts/generate-extension-catalog.ts
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const OUTPUT = join(ROOT, "apps/app/public/extension-catalog.json");

interface CatalogExtension {
  id: string;
  packageName: string;
  name: string;
  description: string;
  type: "integration" | "plugin" | "widget";
  category?: string;
  version?: string;
  tier?: string;
  requiredCapabilities?: string[];
  hasChangelog: boolean;
  hasReadme: boolean;
}

interface CatalogOutput {
  generatedAt: string;
  extensions: CatalogExtension[];
}

// ---------------------------------------------------------------------------
// Read config
// ---------------------------------------------------------------------------

async function loadConfig() {
  const mod = await import(join(ROOT, "radarboard.config.ts"));
  return mod.default as {
    integrations: string[];
    plugins: string[];
    widgets: string[];
  };
}

function extensionId(packageName: string, type: "integration" | "plugin" | "widget"): string {
  return packageName.replace(`@radarboard/${type}-`, "");
}

// ---------------------------------------------------------------------------
// Extract descriptor metadata by reading the source file
// ---------------------------------------------------------------------------

function extractDescriptorFields(
  filePath: string,
): { name?: string; description?: string; category?: string; version?: string } {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, "utf-8");

  const nameMatch = content.match(/name:\s*["']([^"']+)["']/);
  const descMatch = content.match(/description:\s*["']([^"']+)["']/);
  const categoryMatch = content.match(/category:\s*["']([^"']+)["']/);
  const versionMatch = content.match(/version:\s*["']([^"']+)["']/);

  return {
    name: nameMatch?.[1],
    description: descMatch?.[1],
    category: categoryMatch?.[1],
    version: versionMatch?.[1],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const config = await loadConfig();
  const extensions: CatalogExtension[] = [];

  // Integrations
  for (const packageName of config.integrations) {
    const id = extensionId(packageName, "integration");
    const dir = join(ROOT, "integrations", id);
    const indexPath = join(dir, "src/index.ts");
    const fields = extractDescriptorFields(indexPath);

    extensions.push({
      id,
      packageName,
      name: fields.name ?? id,
      description: fields.description ?? "",
      type: "integration",
      category: fields.category,
      tier: "official",
      hasChangelog: existsSync(join(dir, "CHANGELOG.md")),
      hasReadme: existsSync(join(dir, "README.md")),
    });
  }

  // Plugins
  for (const packageName of config.plugins) {
    const id = extensionId(packageName, "plugin");
    const dir = join(ROOT, "plugins", id);
    const indexPath = join(dir, "src/index.ts");
    const fields = extractDescriptorFields(indexPath);

    extensions.push({
      id,
      packageName,
      name: fields.name ?? id,
      description: fields.description ?? "",
      type: "plugin",
      category: fields.category,
      version: fields.version,
      tier: "official",
      hasChangelog: existsSync(join(dir, "CHANGELOG.md")),
      hasReadme: existsSync(join(dir, "README.md")),
    });
  }

  // Widgets
  for (const packageName of config.widgets) {
    const id = extensionId(packageName, "widget");
    const dir = join(ROOT, "widgets", id);
    const indexPath = join(dir, "src/index.ts");
    const fields = extractDescriptorFields(indexPath);

    extensions.push({
      id,
      packageName,
      name: fields.name ?? id,
      description: fields.description ?? "",
      type: "widget",
      category: fields.category,
      version: fields.version,
      tier: "official",
      hasChangelog: existsSync(join(dir, "CHANGELOG.md")),
      hasReadme: existsSync(join(dir, "README.md")),
    });
  }

  const output: CatalogOutput = {
    generatedAt: new Date().toISOString(),
    extensions,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + "\n", "utf-8");
  console.log(`Generated catalog with ${extensions.length} extensions → ${OUTPUT}`);
}

main();
