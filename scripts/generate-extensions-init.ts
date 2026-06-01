#!/usr/bin/env tsx
/**
 * Generate extension init files from radarboard.config.ts.
 *
 * Reads the root config and produces:
 *   - apps/app/lib/extensions/runtime/integrations-init.ts
 *   - apps/app/lib/extensions/runtime/plugins-init.ts
 *   - apps/app/lib/extensions/runtime/widgets-init.ts
 *
 * Usage: pnpm generate:extensions
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const WEB_LIB = join(ROOT, "apps/app/lib/extensions/runtime");
const DEV_EXTENSIONS_MANIFEST = join(ROOT, ".radarboard/dev-extensions.json");
const HEADER = "// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.\n";

// ---------------------------------------------------------------------------
// Load config
// ---------------------------------------------------------------------------

type DevExtensionEntry = {
  type: "integration" | "plugin" | "widget";
  path: string;
};

type RadarboardConfig = {
  devExtensions?: DevExtensionEntry[];
  features: string[];
  integrations: string[];
  virtualIntegrations: string[];
  plugins: string[];
  widgets: string[];
};

export function loadLocalDevExtensions(manifestPath = DEV_EXTENSIONS_MANIFEST): DevExtensionEntry[] {
  if (!existsSync(manifestPath)) return [];

  const raw = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
    devExtensions?: DevExtensionEntry[];
  };

  if (!Array.isArray(raw.devExtensions)) return [];

  return raw.devExtensions.filter((entry) => {
    if (!["integration", "plugin", "widget"].includes(entry.type)) return false;
    return typeof entry.path === "string" && entry.path.length > 0;
  });
}

export function mergeConfigWithLocalDevExtensions(
  config: RadarboardConfig,
  manifestPath = DEV_EXTENSIONS_MANIFEST
): RadarboardConfig {
  const localDevExtensions = loadLocalDevExtensions(manifestPath);
  if (localDevExtensions.length === 0) return config;

  return {
    ...config,
    devExtensions: [...(config.devExtensions ?? []), ...localDevExtensions],
  };
}

async function loadConfig(): Promise<RadarboardConfig> {
  const mod = await import(join(ROOT, "radarboard.config.ts"));
  return mergeConfigWithLocalDevExtensions(mod.default as RadarboardConfig);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "@radarboard/integration-github" → "github" */
function extractId(pkg: string, prefix: string): string {
  return pkg.replace(prefix, "");
}

/** "github" → "github" | "app-store-connect" → "appStoreConnect" */
function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/** Read a package.json exports map to check for optional exports */
function getPackageExports(pkg: string): Record<string, string> {
  // Resolve workspace package path from package name
  const segments = pkg.replace("@radarboard/", "").split("-");

  // Try to find the package in standard locations
  const candidates = [
    join(ROOT, "features", extractId(pkg, "@radarboard/feature-")),
    join(ROOT, "integrations", extractId(pkg, "@radarboard/integration-")),
    join(ROOT, "plugins", extractId(pkg, "@radarboard/plugin-")),
    join(ROOT, "widgets", extractId(pkg, "@radarboard/widget-")),
    join(ROOT, "packages", extractId(pkg, "@radarboard/")),
  ];

  for (const dir of candidates) {
    const pkgJsonPath = join(dir, "package.json");
    if (existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
      return pkgJson.exports ?? {};
    }
  }

  return {};
}

/** Check that a subpath export exists AND the target file is on disk. */
function hasExport(pkg: string, subpath: string): boolean {
  const exports = getPackageExports(pkg);
  const entry = exports[`./${subpath}`];
  if (!entry) return false;

  // Resolve the file path relative to the package directory
  const candidates = [
    join(ROOT, "features", extractId(pkg, "@radarboard/feature-")),
    join(ROOT, "integrations", extractId(pkg, "@radarboard/integration-")),
    join(ROOT, "plugins", extractId(pkg, "@radarboard/plugin-")),
    join(ROOT, "widgets", extractId(pkg, "@radarboard/widget-")),
    join(ROOT, "packages", extractId(pkg, "@radarboard/")),
  ];

  for (const dir of candidates) {
    const resolved = join(dir, entry);
    if (existsSync(resolved)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Generate integrations-init.ts
// ---------------------------------------------------------------------------

function generateIntegrationsInit(config: RadarboardConfig): string {
  const lines: string[] = [HEADER];
  lines.push("/**");
  lines.push(" * Side-effect import that registers all first-party integrations.");
  lines.push(" * Import this early in the app to populate INTEGRATION_REGISTRY.");
  lines.push(" */\n");

  // Imports for standard integrations
  for (const pkg of config.integrations) {
    const id = extractId(pkg, "@radarboard/integration-");
    const camel = toCamelCase(id);
    lines.push(`import { ${camel}Descriptor } from "${pkg}";`);
  }

  // Imports for virtual integrations (data sources only)
  for (const pkg of config.virtualIntegrations) {
    const id = extractId(pkg, "@radarboard/integration-");
    const camel = toCamelCase(id);
    lines.push(`import { ${camel}DataSources } from "${pkg}/data-sources";`);
  }

  const registryImports = ["registerDataSources"];
  if (config.integrations.length > 0) {
    registryImports.push("registerIntegration");
  }
  lines.push(
    `import { ${registryImports.join(", ")} } from "@radarboard/integration-sdk/registry";`
  );

  lines.push("");
  lines.push('const INTEGRATIONS_INIT_KEY = "__radarboardAppIntegrationsInitialized__";');
  lines.push("");
  lines.push("type IntegrationsInitState = typeof globalThis & {");
  lines.push("  __radarboardAppIntegrationsInitialized__?: boolean;");
  lines.push("};");
  lines.push("");
  lines.push("export function initializeIntegrations(): void {");
  lines.push("  const state = globalThis as IntegrationsInitState;");
  lines.push("  if (state[INTEGRATIONS_INIT_KEY]) return;");
  lines.push("");
  lines.push("  state[INTEGRATIONS_INIT_KEY] = true;");
  lines.push("");

  // Register standard integrations
  for (const pkg of config.integrations) {
    const id = extractId(pkg, "@radarboard/integration-");
    const camel = toCamelCase(id);
    lines.push(`  registerIntegration(${camel}Descriptor);`);
  }

  lines.push("");
  lines.push("  // Virtual integrations — composite data sources with no IntegrationDescriptor.");

  // Register virtual integrations
  for (const pkg of config.virtualIntegrations) {
    const id = extractId(pkg, "@radarboard/integration-");
    const camel = toCamelCase(id);
    lines.push(`  registerDataSources("${id}", ${camel}DataSources);`);
  }

  lines.push("");
  lines.push("}");
  lines.push("");
  lines.push("initializeIntegrations();");
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Generate plugins-init.ts
// ---------------------------------------------------------------------------

function generatePluginsInit(config: RadarboardConfig): string {
  const lines: string[] = [HEADER];
  lines.push("/**");
  lines.push(" * Registers all first-party plugins.");
  lines.push(" * Import this early in the app before PluginHost mounts.");
  lines.push(" */\n");

  // Plugin descriptor imports
  for (const pkg of config.plugins) {
    const id = extractId(pkg, "@radarboard/plugin-");
    const camel = toCamelCase(id);
    lines.push(`import { ${camel}Descriptor } from "${pkg}";`);
  }

  lines.push(`import { registerPlugin } from "@radarboard/plugin-sdk/registry";`);

  // Widget contribution imports (from each plugin's widget-contribution module)
  for (const pkg of config.plugins) {
    const id = extractId(pkg, "@radarboard/plugin-");
    const camel = toCamelCase(id);
    const contributionName = camel === "rssReader" ? "rss" : camel;
    if (hasExport(pkg, "widget-contribution")) {
      lines.push(`import { ${contributionName}WidgetContribution } from "${pkg}/widget-contribution";`);
    }
  }

  lines.push("");

  // Register each plugin with its widget contribution (if it has one)
  for (const pkg of config.plugins) {
    const id = extractId(pkg, "@radarboard/plugin-");
    const camel = toCamelCase(id);
    const contributionName = camel === "rssReader" ? "rss" : camel;
    if (hasExport(pkg, "widget-contribution")) {
      lines.push(`registerPlugin({ ...${camel}Descriptor, widgets: [${contributionName}WidgetContribution] });`);
    } else {
      lines.push(`registerPlugin(${camel}Descriptor);`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Generate widgets-init.ts
// ---------------------------------------------------------------------------

function generateWidgetsInit(config: RadarboardConfig): string {
  const lines: string[] = [HEADER];
  lines.push("/**");
  lines.push(" * Registers all first-party widgets.");
  lines.push(" */\n");

  // Descriptor imports
  lines.push("// ─── Widget descriptors ──────────────────────────────────────────────────────");
  for (const pkg of config.widgets) {
    const id = extractId(pkg, "@radarboard/widget-");
    const camel = toCamelCase(id);
    lines.push(`import { ${camel}Descriptor } from "${pkg}";`);

    // Optional init import
    if (hasExport(pkg, "init")) {
      const initFn = `initialize${camel.charAt(0).toUpperCase()}${camel.slice(1)}Widget`;
      lines.push(`import { ${initFn} } from "${pkg}/init";`);
    }
  }

  lines.push(`import { registerWidget } from "@radarboard/widget-engine/widgets/registry";`);

  // Data resolver side-effect imports
  lines.push("");
  lines.push("// ─── Widget data resolvers (self-registering side effects) ────────────────────");
  for (const pkg of config.widgets) {
    if (hasExport(pkg, "data-resolver")) {
      lines.push(`import "${pkg}/data-resolver";`);
    }
  }

  // Export initializeWidgets function
  lines.push("");
  lines.push("export function initializeWidgets() {");
  lines.push("  // Register Descriptors");
  for (const pkg of config.widgets) {
    const id = extractId(pkg, "@radarboard/widget-");
    const camel = toCamelCase(id);
    lines.push(`  registerWidget(${camel}Descriptor);`);
  }

  // Collect widgets with init functions
  const widgetsWithInit = config.widgets.filter((pkg) => hasExport(pkg, "init"));
  if (widgetsWithInit.length > 0) {
    lines.push("");
    lines.push("  // Initialize Widget-specific logic (Detail Renderers, etc.)");
    for (const pkg of widgetsWithInit) {
      const id = extractId(pkg, "@radarboard/widget-");
      const camel = toCamelCase(id);
      const initFn = `initialize${camel.charAt(0).toUpperCase()}${camel.slice(1)}Widget`;
      lines.push(`  ${initFn}();`);
    }
  }

  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Generate features-init.ts
// ---------------------------------------------------------------------------

function generateFeaturesInit(config: RadarboardConfig): string {
  const lines: string[] = [HEADER];
  lines.push("/**");
  lines.push(" * Registers all feature descriptors from feature packages.");
  lines.push(" * Import this in features.ts to populate FEATURE_REGISTRY.");
  lines.push(" */\n");

  // Descriptor imports
  for (const pkg of config.features) {
    const id = extractId(pkg, "@radarboard/feature-");
    const camel = toCamelCase(id);
    lines.push(`import { ${camel}Descriptor } from "${pkg}";`);
  }

  lines.push(`import { registerFeature } from "@radarboard/feature-sdk/registry";`);
  lines.push(`import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";`);
  lines.push("");

  // Export descriptors array
  lines.push("/** All feature descriptors from packages (user-tier). */");
  lines.push("export const featureDescriptors: FeatureDescriptor[] = [");
  for (const pkg of config.features) {
    const id = extractId(pkg, "@radarboard/feature-");
    const camel = toCamelCase(id);
    lines.push(`  ${camel}Descriptor,`);
  }
  lines.push("];");
  lines.push("");

  // Register all
  lines.push("/** Register all feature descriptors. Idempotent (HMR-safe). */");
  lines.push("export function registerFeatures(): void {");
  lines.push("  for (const descriptor of featureDescriptors) {");
  lines.push("    registerFeature(descriptor);");
  lines.push("  }");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Generate transpile-packages.ts (auto-synced list for next.config.ts)
// ---------------------------------------------------------------------------

function generateTranspilePackages(config: RadarboardConfig): string {
  const lines: string[] = [HEADER];
  lines.push("/**");
  lines.push(" * Auto-generated list of workspace packages that Next.js must transpile.");
  lines.push(" * Imported by next.config.ts — do not edit manually.");
  lines.push(" */\n");

  // Core packages that always need transpilation
  const corePackages = [
    "@radarboard/integration-sdk",
    "@radarboard/ui",
    "@radarboard/assistant-ui",
    "@radarboard/assistant-core",
    "@radarboard/widget-engine",
    "@radarboard/charts",
    "@radarboard/hooks",
    "@radarboard/utils",
    "@radarboard/types",
    "@radarboard/observability",
    "@radarboard/plugin-sdk",
    "motion",
  ];

  const all = [
    ...corePackages,
    ...config.integrations,
    ...config.virtualIntegrations,
    ...config.widgets,
  ];

  lines.push("export const transpilePackages: string[] = [");
  for (const pkg of all) {
    lines.push(`  "${pkg}",`);
  }
  lines.push("];\n");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Sync extension dependencies in apps/app/package.json
// ---------------------------------------------------------------------------

/** Extension package prefixes that are auto-managed. */
const EXTENSION_PREFIXES = [
  "@radarboard/integration-",
  "@radarboard/plugin-",
  "@radarboard/widget-",
  "@radarboard/feature-",
];

/** Packages that look like extensions but are core SDKs — never auto-managed. */
const CORE_SDKS = new Set([
  "@radarboard/integration-sdk",
  "@radarboard/plugin-sdk",
  "@radarboard/widget-sdk",
  "@radarboard/widget-engine",
  "@radarboard/feature-sdk",
]);

function isExtensionPackage(dep: string): boolean {
  if (CORE_SDKS.has(dep)) return false;
  return EXTENSION_PREFIXES.some((prefix) => dep.startsWith(prefix));
}

function syncAppPackageJson(config: RadarboardConfig): { added: string[]; removed: string[] } {
  const appPkgPath = join(ROOT, "apps/app/package.json");
  const pkg = JSON.parse(readFileSync(appPkgPath, "utf-8"));
  const deps: Record<string, string> = pkg.dependencies ?? {};

  // Desired extension deps from config
  const desired = new Set([
    ...config.features,
    ...config.integrations,
    ...config.virtualIntegrations,
    ...config.plugins,
    ...config.widgets,
  ]);

  const added: string[] = [];
  const removed: string[] = [];

  // Add missing extensions
  for (const ext of desired) {
    if (!deps[ext]) {
      deps[ext] = "workspace:*";
      added.push(ext);
    }
  }

  // Remove stale extensions (extension-prefixed deps not in config)
  for (const dep of Object.keys(deps)) {
    if (isExtensionPackage(dep) && !desired.has(dep)) {
      delete deps[dep];
      removed.push(dep);
    }
  }

  // Sort deps alphabetically
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(deps).sort()) {
    sorted[key] = deps[key];
  }
  pkg.dependencies = sorted;

  writeFileSync(appPkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return { added, removed };
}

// ---------------------------------------------------------------------------
// Generate dev-extensions-init.ts (local filesystem extensions for dev mode)
// ---------------------------------------------------------------------------

function generateDevExtensionsInit(config: RadarboardConfig): string {
  const devExts = config.devExtensions ?? [];
  if (devExts.length === 0) {
    return [
      HEADER,
      "/** No dev extensions configured. Add entries to `devExtensions` in radarboard.config.ts. */",
      "export function initializeDevExtensions(): void {",
      "  // Intentionally empty when no dev extensions are configured.",
      "}",
      "",
    ].join("\n");
  }

  const lines: string[] = [HEADER];
  lines.push("/**");
  lines.push(" * Registers local dev extensions from filesystem paths.");
  lines.push(" * Only loaded when NODE_ENV !== 'production'.");
  lines.push(" * Configure in radarboard.config.ts → devExtensions.");
  lines.push(" */\n");

  const integrations = devExts.filter((e) => e.type === "integration");
  const plugins = devExts.filter((e) => e.type === "plugin");
  const widgets = devExts.filter((e) => e.type === "widget");

  // Generate import aliases from paths
  let idx = 0;
  const aliases: Array<{ alias: string; entry: DevExtensionEntry }> = [];

  for (const entry of devExts) {
    const alias = `devExt${idx++}`;
    aliases.push({ alias, entry });
    // Use relative path from apps/app/lib/ to the dev extension
    const relativePath = resolve(ROOT, entry.path);
    lines.push(`import { default as ${alias}Module } from "${relativePath}";`);
  }

  // Registry imports
  if (integrations.length > 0) {
    lines.push(`import { registerIntegration } from "@radarboard/integration-sdk/registry";`);
  }
  if (plugins.length > 0) {
    lines.push(`import { registerPlugin } from "@radarboard/plugin-sdk/registry";`);
  }
  if (widgets.length > 0) {
    lines.push(`import { registerWidget } from "@radarboard/widget-engine/widgets/registry";`);
  }

  lines.push("");
  lines.push("export function initializeDevExtensions(): void {");
  lines.push('  if (process.env.NODE_ENV === "production") return;\n');

  for (const { alias, entry } of aliases) {
    // Each dev extension module is expected to have a default export with a descriptor
    // or a named export matching the pattern: *Descriptor
    const registerFn =
      entry.type === "integration"
        ? "registerIntegration"
        : entry.type === "plugin"
          ? "registerPlugin"
          : "registerWidget";

    lines.push(`  // Dev extension: ${entry.path} (${entry.type})`);
    lines.push(`  const ${alias}Descriptor = ${alias}Module.descriptor ?? ${alias}Module.default ?? Object.values(${alias}Module).find((v: any) => v?.id && v?.name);`);
    lines.push(`  if (${alias}Descriptor) {`);
    lines.push(`    console.log("[dev-ext] Registering ${entry.type}: " + ${alias}Descriptor.name);`);
    lines.push(`    ${registerFn}(${alias}Descriptor);`);
    lines.push(`  } else {`);
    lines.push(`    console.warn("[dev-ext] No descriptor found in ${entry.path}");`);
    lines.push(`  }`);
    lines.push("");
  }

  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const config = await loadConfig();

  const featuresPath = join(WEB_LIB, "features-init.ts");
  const integrationsPath = join(WEB_LIB, "integrations-init.ts");
  const pluginsPath = join(WEB_LIB, "plugins-init.ts");
  const widgetsPath = join(WEB_LIB, "widgets-init.ts");
  const transpilePath = join(WEB_LIB, "transpile-packages.ts");
  const devExtPath = join(WEB_LIB, "dev-extensions-init.ts");

  writeFileSync(featuresPath, generateFeaturesInit(config));
  console.log(`✓ ${featuresPath}`);

  writeFileSync(integrationsPath, generateIntegrationsInit(config));
  console.log(`✓ ${integrationsPath}`);

  writeFileSync(pluginsPath, generatePluginsInit(config));
  console.log(`✓ ${pluginsPath}`);

  writeFileSync(widgetsPath, generateWidgetsInit(config));
  console.log(`✓ ${widgetsPath}`);

  writeFileSync(transpilePath, generateTranspilePackages(config));
  console.log(`✓ ${transpilePath}`);

  writeFileSync(devExtPath, generateDevExtensionsInit(config));
  const devCount = (config.devExtensions ?? []).length;
  console.log(`✓ ${devExtPath}${devCount > 0 ? ` (${devCount} dev extension(s))` : " (empty)"}`);

  // Sync extension deps in apps/app/package.json
  const { added, removed } = syncAppPackageJson(config);
  const appPkgPath = join(ROOT, "apps/app/package.json");
  if (added.length > 0 || removed.length > 0) {
    console.log(`✓ ${appPkgPath}`);
    for (const pkg of added) console.log(`  + ${pkg}`);
    for (const pkg of removed) console.log(`  - ${pkg}`);
  } else {
    console.log(`✓ ${appPkgPath} (no changes)`);
  }

  console.log("\nDone. Extension init files regenerated from radarboard.config.ts.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Failed to generate extension init files:", err);
    process.exit(1);
  });
}
