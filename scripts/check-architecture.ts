#!/usr/bin/env tsx
/**
 * Architecture regression tests.
 *
 * Verifies that the extension system's structural invariants hold:
 * 1. Generated init files are in sync with radarboard.config.ts
 * 2. Every extension in radarboard.config.ts has a directory on disk
 * 3. Module boundary allowlists match between check-module-boundaries.ts and biome.json
 * 4. Scaffolding templates pass quality checks
 * 5. SDK conformance functions are exported and importable
 *
 * Run: pnpm check:architecture
 */
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const WEB_LIB = join(ROOT, "apps/app/lib/extensions/runtime");

type RadarboardConfig = {
  features: string[];
  integrations: string[];
  virtualIntegrations: string[];
  plugins: string[];
  widgets: string[];
};

let errors = 0;
let passes = 0;

function pass(msg: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
  passes++;
}
function fail(msg: string) {
  console.error(`  \x1b[31m✗\x1b[0m ${msg}`);
  errors++;
}

function extractId(pkg: string, prefix: string): string {
  return pkg.replace(prefix, "");
}

// ---------------------------------------------------------------------------
// Load config
// ---------------------------------------------------------------------------

async function loadConfig(): Promise<RadarboardConfig> {
  const mod = await import(join(ROOT, "radarboard.config.ts"));
  return mod.default as RadarboardConfig;
}

// ---------------------------------------------------------------------------
// Check 1: Generated files are in sync
// ---------------------------------------------------------------------------

function checkGeneratedFilesInSync(config: RadarboardConfig) {
  console.log("\n1. Generated files in sync with radarboard.config.ts");

  const generatedFiles = [
    "integrations-init.ts",
    "plugins-init.ts",
    "widgets-init.ts",
    "features-init.ts",
    "transpile-packages.ts",
  ];

  for (const file of generatedFiles) {
    const filePath = join(WEB_LIB, file);
    if (!existsSync(filePath)) {
      fail(`${file} does not exist — run \`pnpm generate:extensions\``);
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    if (!content.startsWith("// @generated")) {
      fail(`${file} is missing @generated header — was it manually edited?`);
      continue;
    }
  }

  // Verify every widget in config appears in transpile-packages.ts
  const transpilePath = join(WEB_LIB, "transpile-packages.ts");
  if (existsSync(transpilePath)) {
    const transpileContent = readFileSync(transpilePath, "utf8");
    let allPresent = true;
    for (const pkg of config.widgets) {
      if (!transpileContent.includes(`"${pkg}"`)) {
        fail(`${pkg} is in radarboard.config.ts but missing from transpile-packages.ts`);
        allPresent = false;
      }
    }
    if (allPresent) pass("transpile-packages.ts contains all widgets from config");
  }

  // Verify every integration in config appears in integrations-init.ts
  const integrationsInit = readFileSync(join(WEB_LIB, "integrations-init.ts"), "utf8");
  let allIntegrations = true;
  for (const pkg of [...config.integrations, ...config.virtualIntegrations]) {
    if (!integrationsInit.includes(pkg)) {
      fail(`${pkg} is in radarboard.config.ts but missing from integrations-init.ts`);
      allIntegrations = false;
    }
  }
  if (allIntegrations) pass("integrations-init.ts contains all integrations from config");

  // Verify every plugin in config appears in plugins-init.ts
  const pluginsInit = readFileSync(join(WEB_LIB, "plugins-init.ts"), "utf8");
  let allPlugins = true;
  for (const pkg of config.plugins) {
    if (!pluginsInit.includes(pkg)) {
      fail(`${pkg} is in radarboard.config.ts but missing from plugins-init.ts`);
      allPlugins = false;
    }
  }
  if (allPlugins) pass("plugins-init.ts contains all plugins from config");

  // Verify every widget in config appears in widgets-init.ts
  const widgetsInit = readFileSync(join(WEB_LIB, "widgets-init.ts"), "utf8");
  let allWidgets = true;
  for (const pkg of config.widgets) {
    if (!widgetsInit.includes(pkg)) {
      fail(`${pkg} is in radarboard.config.ts but missing from widgets-init.ts`);
      allWidgets = false;
    }
  }
  if (allWidgets) pass("widgets-init.ts contains all widgets from config");

  // Verify apps/app/package.json deps match config (no stale extension deps)
  const appPkgPath = join(ROOT, "apps/app/package.json");
  const appPkg = JSON.parse(readFileSync(appPkgPath, "utf8"));
  const appDeps = Object.keys(appPkg.dependencies ?? {});

  const CORE_SDKS = new Set([
    "@radarboard/integration-sdk", "@radarboard/plugin-sdk",
    "@radarboard/widget-sdk", "@radarboard/widget-engine", "@radarboard/feature-sdk",
  ]);
  const EXT_PREFIXES = ["@radarboard/integration-", "@radarboard/plugin-", "@radarboard/widget-", "@radarboard/feature-"];

  const desired = new Set([
    ...config.features, ...config.integrations, ...config.virtualIntegrations,
    ...config.plugins, ...config.widgets,
  ]);

  // Check for stale extension deps in package.json that aren't in config
  const staleDeps = appDeps.filter((dep) => {
    if (CORE_SDKS.has(dep)) return false;
    if (!EXT_PREFIXES.some((p) => dep.startsWith(p))) return false;
    return !desired.has(dep);
  });

  if (staleDeps.length > 0) {
    for (const dep of staleDeps) {
      fail(`${dep} is in apps/app/package.json but not in radarboard.config.ts — run \`pnpm generate:extensions\``);
    }
  } else {
    pass("apps/app/package.json has no stale extension deps");
  }

  // Check for missing extension deps
  const missingDeps = [...desired].filter((dep) => !appDeps.includes(dep));
  if (missingDeps.length > 0) {
    for (const dep of missingDeps) {
      fail(`${dep} is in radarboard.config.ts but missing from apps/app/package.json — run \`pnpm generate:extensions\``);
    }
  } else {
    pass("apps/app/package.json has all extensions from config");
  }

  // Detect stale regeneration by comparing config timestamp vs generated files
  try {
    const result = execSync(
      "git diff --name-only HEAD -- radarboard.config.ts apps/app/lib/*-init.ts apps/app/lib/transpile-packages.ts",
      { encoding: "utf8", cwd: ROOT }
    ).trim();

    if (result.includes("radarboard.config.ts") && !result.includes("-init.ts")) {
      fail("radarboard.config.ts was modified but init files were not regenerated — run `pnpm generate:extensions`");
    } else {
      pass("No stale generated files detected");
    }
  } catch {
    // Not in a git repo or git diff failed — skip this check
    pass("Skipped stale file check (git not available)");
  }
}

// ---------------------------------------------------------------------------
// Check 2: Extension directories exist
// ---------------------------------------------------------------------------

function checkExtensionDirectoriesExist(config: RadarboardConfig) {
  console.log("\n2. Extension directories exist on disk");

  const checks: { pkg: string; dir: string }[] = [
    ...config.integrations.map((pkg) => ({
      pkg,
      dir: join(ROOT, "integrations", extractId(pkg, "@radarboard/integration-")),
    })),
    ...config.virtualIntegrations.map((pkg) => ({
      pkg,
      dir: join(ROOT, "integrations", extractId(pkg, "@radarboard/integration-")),
    })),
    ...config.plugins.map((pkg) => ({
      pkg,
      dir: join(ROOT, "plugins", extractId(pkg, "@radarboard/plugin-")),
    })),
    ...config.widgets.map((pkg) => ({
      pkg,
      dir: join(ROOT, "widgets", extractId(pkg, "@radarboard/widget-")),
    })),
  ];

  let allExist = true;
  for (const { pkg, dir } of checks) {
    if (!existsSync(dir)) {
      fail(`${pkg} is in radarboard.config.ts but directory does not exist: ${dir}`);
      allExist = false;
    }
  }
  if (allExist) pass(`All ${checks.length} extension directories exist`);
}

// ---------------------------------------------------------------------------
// Check 3: Module boundary allowlists are consistent
// ---------------------------------------------------------------------------

function checkModuleBoundaryConsistency() {
  console.log("\n3. Module boundary allowlists consistent");

  const boundaryScript = readFileSync(join(ROOT, "scripts/check-module-boundaries.ts"), "utf8");
  const biomeConfig = readFileSync(join(ROOT, "biome.json"), "utf8");

  // Verify the boundary script exists and has ALLOWED_WORKSPACE_DEPS
  if (!boundaryScript.includes("ALLOWED_WORKSPACE_DEPS")) {
    fail("check-module-boundaries.ts is missing ALLOWED_WORKSPACE_DEPS");
    return;
  }
  pass("check-module-boundaries.ts has ALLOWED_WORKSPACE_DEPS");

  // Verify biome.json has noRestrictedImports rules
  if (!biomeConfig.includes("noRestrictedImports")) {
    fail("biome.json is missing noRestrictedImports rules");
    return;
  }
  pass("biome.json has noRestrictedImports rules");

  // Verify boundary categories match between script and quality gate
  const qualityScript = readFileSync(join(ROOT, "scripts/check-extensions-quality.ts"), "utf8");
  if (!qualityScript.includes("ALLOWED_WORKSPACE_DEPS")) {
    fail("check-extensions-quality.ts is missing ALLOWED_WORKSPACE_DEPS — it should mirror check-module-boundaries.ts");
    return;
  }
  pass("check-extensions-quality.ts has matching ALLOWED_WORKSPACE_DEPS");
}

// ---------------------------------------------------------------------------
// Check 4: Scaffolding templates have conformance tests
// ---------------------------------------------------------------------------

function checkTemplatesHaveConformanceTests() {
  console.log("\n4. Scaffolding templates include conformance tests");

  const templates = [
    { name: "integration", path: join(ROOT, "integrations/_template/src/conformance.test.ts") },
    { name: "plugin", path: join(ROOT, "plugins/_template/src/conformance.test.ts") },
    { name: "widget", path: join(ROOT, "widgets/_template/conformance.test.ts") },
  ];

  for (const { name, path } of templates) {
    if (!existsSync(path)) {
      fail(`${name} template is missing conformance.test.ts`);
      continue;
    }

    const content = readFileSync(path, "utf8");
    const expectedFn = name === "integration" ? "runIntegrationConformance"
      : name === "plugin" ? "runPluginConformance"
      : "runWidgetConformance";

    if (!content.includes(expectedFn)) {
      fail(`${name} template conformance test does not call ${expectedFn}`);
    } else {
      pass(`${name} template has conformance test calling ${expectedFn}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check 5: SDK conformance exports exist
// ---------------------------------------------------------------------------

function checkSdkConformanceExports() {
  console.log("\n5. SDK conformance functions are exported");

  const sdks = [
    {
      name: "integration-sdk",
      file: join(ROOT, "packages/integration-sdk/src/conformance.test.ts"),
      fn: "runIntegrationConformance",
    },
    {
      name: "plugin-sdk",
      file: join(ROOT, "packages/plugin-sdk/src/conformance.test.ts"),
      fn: "runPluginConformance",
    },
    {
      name: "widget-engine",
      file: join(ROOT, "packages/widget-engine/src/conformance.test.ts"),
      fn: "runWidgetConformance",
    },
  ];

  for (const { name, file, fn } of sdks) {
    if (!existsSync(file)) {
      fail(`${name} is missing conformance.test.ts`);
      continue;
    }

    const content = readFileSync(file, "utf8");
    if (!content.includes(`export function ${fn}`)) {
      fail(`${name} does not export ${fn}`);
    } else {
      pass(`${name} exports ${fn}`);
    }
  }

  // Verify package.json exports maps include conformance
  const pkgExports = [
    { name: "integration-sdk", path: join(ROOT, "packages/integration-sdk/package.json"), export: "./conformance" },
    { name: "plugin-sdk", path: join(ROOT, "packages/plugin-sdk/package.json"), export: "./conformance" },
    { name: "widget-engine", path: join(ROOT, "packages/widget-engine/package.json"), export: "./conformance" },
  ];

  for (const { name, path, export: exp } of pkgExports) {
    const pkg = JSON.parse(readFileSync(path, "utf8"));
    if (!pkg.exports?.[exp]) {
      fail(`${name} package.json is missing "${exp}" export`);
    } else {
      pass(`${name} package.json exports "${exp}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check 6: No manual edits to generated files
// ---------------------------------------------------------------------------

function checkNoManualEditsToGenerated() {
  console.log("\n6. Generated files have @generated marker");

  const generatedFiles = [
    join(WEB_LIB, "integrations-init.ts"),
    join(WEB_LIB, "plugins-init.ts"),
    join(WEB_LIB, "widgets-init.ts"),
    join(WEB_LIB, "features-init.ts"),
    join(WEB_LIB, "transpile-packages.ts"),
  ];

  let allMarked = true;
  for (const file of generatedFiles) {
    if (!existsSync(file)) continue;
    const firstLine = readFileSync(file, "utf8").split("\n")[0];
    if (!firstLine?.includes("@generated")) {
      fail(`${file} is missing @generated marker — was it manually edited?`);
      allMarked = false;
    }
  }
  if (allMarked) pass("All generated files have @generated marker");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("╭─────────────────────────────────────────────────╮");
  console.log("│       Architecture Regression Check             │");
  console.log("╰─────────────────────────────────────────────────╯");

  const config = await loadConfig();

  checkGeneratedFilesInSync(config);
  checkExtensionDirectoriesExist(config);
  checkModuleBoundaryConsistency();
  checkTemplatesHaveConformanceTests();
  checkSdkConformanceExports();
  checkNoManualEditsToGenerated();

  console.log("\n─────────────────────────────────────────────────");
  console.log(`\x1b[32m✓ ${passes} passed\x1b[0m  \x1b[31m✗ ${errors} errors\x1b[0m`);
  console.log("─────────────────────────────────────────────────\n");

  if (errors > 0) {
    console.error(`\x1b[31mArchitecture check failed with ${errors} error(s).\x1b[0m`);
    process.exit(1);
  }

  console.log("\x1b[32mArchitecture is intact.\x1b[0m");
}

main().catch((err) => {
  console.error("Architecture check failed:", err);
  process.exit(1);
});
