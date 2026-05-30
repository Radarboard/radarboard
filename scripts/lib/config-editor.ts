/**
 * Shared utility for editing radarboard.config.ts.
 *
 * Used by create-widget, create-integration, create-plugin,
 * and the extension installer.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const CONFIG_PATH = join(ROOT, "radarboard.config.ts");

export type ExtensionCategory = "integration" | "plugin" | "widget" | "feature";

const CATEGORY_CONFIG: Record<ExtensionCategory, { arrayName: string; prefix: string }> = {
  integration: { arrayName: "integrations", prefix: "@radarboard/integration-" },
  plugin: { arrayName: "plugins", prefix: "@radarboard/plugin-" },
  widget: { arrayName: "widgets", prefix: "@radarboard/widget-" },
  feature: { arrayName: "features", prefix: "@radarboard/feature-" },
};

/**
 * Add an extension to radarboard.config.ts in alphabetical order.
 * Returns true if added, false if already present.
 */
export function addToConfig(category: ExtensionCategory, kebabId: string): boolean {
  const { arrayName, prefix } = CATEGORY_CONFIG[category];
  const packageName = `"${prefix}${kebabId}"`;

  const configContent = readFileSync(CONFIG_PATH, "utf-8");

  if (configContent.includes(packageName)) {
    return false;
  }

  // Find the array and extract existing entries
  const arrayRegex = new RegExp(`(${arrayName}:\\s*\\[)([\\s\\S]*?)(\\s*\\],?)`);
  const match = configContent.match(arrayRegex);

  if (!match) {
    console.warn(`  Warning: Could not find ${arrayName} array in radarboard.config.ts. Add manually:`);
    console.warn(`    ${packageName},`);
    return false;
  }

  const arrayContent = match[2] ?? "";
  const entryRegex = new RegExp(`"${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^"]+)"`, "g");
  const entries: { name: string }[] = [];
  let matchEntry = entryRegex.exec(arrayContent);
  while (matchEntry) {
    const name = matchEntry[1];
    if (name) {
      entries.push({ name });
    }
    matchEntry = entryRegex.exec(arrayContent);
  }

  // Find alphabetical insertion point
  let insertAfterEntry: string | null = null;
  for (const entry of entries) {
    if (entry.name < kebabId) {
      insertAfterEntry = entry.name;
    }
  }

  let newConfigContent: string;

  if (insertAfterEntry) {
    const lineToInsertAfter = `"${prefix}${insertAfterEntry}",`;
    const insertLine = `    ${packageName},`;
    newConfigContent = configContent.replace(
      new RegExp(`(\\s*${lineToInsertAfter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`),
      `$1\n${insertLine}`,
    );
  } else if (entries.length > 0) {
    const firstEntry = entries[0];
    if (!firstEntry) {
      return false;
    }
    const firstLine = `"${prefix}${firstEntry.name}"`;
    const insertLine = `    ${packageName},`;
    newConfigContent = configContent.replace(
      new RegExp(`(${arrayName}:\\s*\\[\\s*\\n)(\\s*${firstLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`),
      `$1${insertLine}\n$2`,
    );
  } else {
    newConfigContent = configContent.replace(
      new RegExp(`${arrayName}:\\s*\\[\\s*\\]`),
      `${arrayName}: [\n    ${packageName},\n  ]`,
    );
  }

  writeFileSync(CONFIG_PATH, newConfigContent);
  return true;
}

/**
 * Remove an extension from radarboard.config.ts.
 * Returns true if removed, false if not found.
 */
export function removeFromConfig(category: ExtensionCategory, kebabId: string): boolean {
  const { prefix } = CATEGORY_CONFIG[category];
  const packageName = `"${prefix}${kebabId}"`;

  const configContent = readFileSync(CONFIG_PATH, "utf-8");

  if (!configContent.includes(packageName)) {
    return false;
  }

  // Remove the line containing the package name
  const lineRegex = new RegExp(`\\s*${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},?\\n`, "g");
  const newConfigContent = configContent.replace(lineRegex, "\n");

  writeFileSync(CONFIG_PATH, newConfigContent);
  return true;
}

/**
 * Detect extension category from a package name.
 * Returns null if the package name doesn't match any extension prefix.
 */
export function detectCategory(packageName: string): { category: ExtensionCategory; id: string } | null {
  for (const [category, { prefix }] of Object.entries(CATEGORY_CONFIG)) {
    if (packageName.startsWith(prefix)) {
      return { category: category as ExtensionCategory, id: packageName.replace(prefix, "") };
    }
  }
  return null;
}

export { CONFIG_PATH, ROOT };
