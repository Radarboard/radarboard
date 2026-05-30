#!/usr/bin/env tsx
/**
 * Unified extension quality gate — validates all active extensions meet
 * structural and quality requirements. Designed to run in CI.
 *
 * Usage: pnpm check:extensions [--filter widget] [--verbose]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

type ExtensionCategory = "integration" | "plugin" | "widget";

interface CheckResult {
  name: string;
  status: "pass" | "warn" | "error";
  message?: string;
}

interface ExtensionReport {
  id: string;
  category: ExtensionCategory;
  packageDir: string;
  checks: CheckResult[];
}

const ALLOWED_WORKSPACE_DEPS: Record<ExtensionCategory, string[]> = {
  integration: [
    "@radarboard/integration-sdk",
    "@radarboard/types",
    "@radarboard/utils",
  ],
  plugin: [
    "@radarboard/plugin-sdk",
    "@radarboard/types",
    "@radarboard/utils",
    "@radarboard/ui",
    "@radarboard/hooks",
    "@radarboard/widget-engine",
    "@radarboard/embedding-service",
    "@radarboard/llm",
  ],
  widget: [
    "@radarboard/widget-sdk",
    "@radarboard/widget-engine",
    "@radarboard/types",
    "@radarboard/utils",
    "@radarboard/ui",
    "@radarboard/charts",
    "@radarboard/hooks",
    "@radarboard/assistant-ui",
  ],
};

const FORBIDDEN_IMPORT_PREFIXES: Record<ExtensionCategory, string[]> = {
  integration: ["@radarboard/plugin-", "@radarboard/widget-", "@radarboard/feature-"],
  plugin: ["@radarboard/integration-", "@radarboard/widget-", "@radarboard/feature-"],
  widget: ["@radarboard/integration-", "@radarboard/plugin-", "@radarboard/feature-"],
};

const ALWAYS_ALLOWED_DEV_DEPS = new Set(["@radarboard/tsconfig"]);

const VIRTUAL_INTEGRATIONS = new Set(["shipping", "astro"]);

const LARGE_DEPS = new Set([
  "moment",
  "lodash",
  "rxjs",
  "three",
  "d3",
  "pdf-lib",
  "pdfjs-dist",
  "xlsx",
]);

const EXTERNAL_DEP_WARNING_EXCEPTIONS = new Set(["plugin/rss-reader"]);

const CONFORMANCE_FUNCTIONS: Record<ExtensionCategory, string> = {
  integration: "runIntegrationConformance",
  plugin: "runPluginConformance",
  widget: "runWidgetConformance",
};

type RadarboardConfig = {
  integrations: string[];
  virtualIntegrations: string[];
  plugins: string[];
  widgets: string[];
};

interface CapabilityAuditLike {
  level: "warn" | "error";
  message: string;
  integrationId?: string;
  widgetId?: string;
}

async function loadConfig(): Promise<RadarboardConfig> {
  const mod = await import(join(ROOT, "radarboard.config.ts"));
  return mod.default as RadarboardConfig;
}

async function loadCapabilityAudits(): Promise<CapabilityAuditLike[]> {
  await import(join(ROOT, "apps/app/lib/extensions/runtime/integrations-init.ts"));
  const widgetsInit = await import(join(ROOT, "apps/app/lib/extensions/runtime/widgets-init.ts"));
  widgetsInit.initializeWidgets();

  const capabilityGovernance = await import(
    join(ROOT, "apps/app/lib/extensions/capability-governance.ts")
  );
  const state = capabilityGovernance.getRegisteredCapabilityGovernanceState();

  return capabilityGovernance.auditCapabilityGovernance(
    state.integrations,
    state.widgets
  ) as CapabilityAuditLike[];
}

function extractId(pkg: string, prefix: string): string {
  return pkg.replace(prefix, "");
}

function checkPackageStructure(dir: string, category: ExtensionCategory, id: string): CheckResult[] {
  const results: CheckResult[] = [];
  const pkgJsonPath = join(dir, "package.json");
  if (!existsSync(pkgJsonPath)) {
    return [{ name: "package.json exists", status: "error", message: "Missing package.json" }];
  }
  results.push({ name: "package.json exists", status: "pass" });
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

  const expectedName = `@radarboard/${category === "integration" ? "integration" : category}-${id}`;
  if (pkg.name !== expectedName) {
    results.push({ name: "package name convention", status: "error", message: `Expected "${expectedName}", got "${pkg.name}"` });
  } else {
    results.push({ name: "package name convention", status: "pass" });
  }

  if (!pkg.exports || typeof pkg.exports !== "object") {
    results.push({ name: "exports map", status: "error", message: "Missing exports map in package.json" });
  } else if (!pkg.exports["."]) {
    results.push({ name: "exports map", status: "error", message: 'Missing "." (default) export entry' });
  } else {
    results.push({ name: "exports map", status: "pass" });
  }

  const entryPath = pkg.exports?.["."];
  if (entryPath) {
    const resolved = join(dir, entryPath);
    if (!existsSync(resolved)) {
      results.push({ name: "entry file exists", status: "error", message: `Export "." points to "${entryPath}" but file does not exist` });
    } else {
      results.push({ name: "entry file exists", status: "pass" });
    }
  }
  return results;
}

function checkExportValidation(dir: string): CheckResult[] {
  const results: CheckResult[] = [];
  const pkgJsonPath = join(dir, "package.json");
  if (!existsSync(pkgJsonPath)) return results;

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  const exports = pkg.exports ?? {};
  let dangling = 0;

  for (const [key, value] of Object.entries(exports)) {
    if (typeof value !== "string") continue;
    // Handle wildcard exports (e.g., "./hooks/*": "./src/hooks/*")
    if (key.includes("*") || (value as string).includes("*")) continue;

    const resolved = join(dir, value as string);
    if (!existsSync(resolved)) {
      dangling++;
      results.push({
        name: `export "${key}"`,
        status: "error",
        message: `Points to "${value}" which does not exist`,
      });
    }
  }

  if (dangling === 0) {
    results.push({ name: "all exports resolve", status: "pass" });
  }

  return results;
}

function checkModuleBoundaries(dir: string, category: ExtensionCategory, id: string): CheckResult[] {
  const pkgJsonPath = join(dir, "package.json");
  if (!existsSync(pkgJsonPath)) return [];
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  const isVirtual = category === "integration" && VIRTUAL_INTEGRATIONS.has(id);
  const ownPackage = `@radarboard/${category === "integration" ? "integration" : category}-${id}`;
  const violations: string[] = [];

  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (!dep.startsWith("@radarboard/") || dep === ownPackage) continue;
    if (ALLOWED_WORKSPACE_DEPS[category].includes(dep)) continue;
    if (isVirtual && dep.startsWith("@radarboard/integration-")) continue;
    violations.push(`Forbidden dependency: ${dep}`);
  }
  for (const dep of Object.keys(pkg.devDependencies ?? {})) {
    if (!dep.startsWith("@radarboard/") || ALWAYS_ALLOWED_DEV_DEPS.has(dep)) continue;
    if (ALLOWED_WORKSPACE_DEPS[category].includes(dep) || dep === ownPackage) continue;
    violations.push(`Unexpected devDependency: ${dep}`);
  }

  for (const file of collectSourceFiles(dir)) {
    const content = readFileSync(file, "utf8");
    const importRegex = /(?:from|import)\s+["'](@radarboard\/[^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const imp = match[1];
      if (imp === ownPackage || imp.startsWith(`${ownPackage}/`)) continue;
      if (ALLOWED_WORKSPACE_DEPS[category].some((a) => imp === a || imp.startsWith(`${a}/`))) continue;
      if (isVirtual && imp.startsWith("@radarboard/integration-")) continue;
      for (const prefix of FORBIDDEN_IMPORT_PREFIXES[category]) {
        if (imp.startsWith(prefix)) {
          violations.push(`${file.replace(`${dir}/`, "")}: forbidden import "${imp}"`);
          break;
        }
      }
    }
  }

  if (violations.length === 0) return [{ name: "module boundaries", status: "pass" }];
  return violations.map((v) => ({ name: "module boundaries", status: "error" as const, message: v }));
}

function checkTestExistence(dir: string, category: ExtensionCategory): CheckResult[] {
  const results: CheckResult[] = [];
  const id = dir.split("/").pop() ?? "";
  const isVirtual = category === "integration" && VIRTUAL_INTEGRATIONS.has(id);

  const testFiles = findFiles(dir, /\.(test|spec)\.(ts|tsx)$/);
  if (testFiles.length === 0) {
    results.push({
      name: "test files exist",
      status: "warn",
      message: "No test files found — extensions should have at least one test",
    });
    return results;
  }
  results.push({ name: "test files exist", status: "pass" });

  // Check for conformance test usage
  const conformanceFn = CONFORMANCE_FUNCTIONS[category];
  const hasConformance = testFiles.some((file) => {
    const content = readFileSync(file, "utf8");
    return content.includes(conformanceFn);
  });

  if (isVirtual) {
    results.push({ name: "conformance test", status: "pass" });
    return results;
  }

  if (!hasConformance) {
    results.push({
      name: "conformance test",
      status: "warn",
      message: `No test calls ${conformanceFn}() — consider adding conformance testing`,
    });
  } else {
    results.push({ name: "conformance test", status: "pass" });
  }

  return results;
}

function checkBundleImpact(dir: string): CheckResult[] {
  const results: CheckResult[] = [];
  const pkgJsonPath = join(dir, "package.json");
  if (!existsSync(pkgJsonPath)) return results;

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  const deps = pkg.dependencies ?? {};
  const extensionKey = dir.includes("/plugins/")
    ? `plugin/${dir.split("/").pop() ?? ""}`
    : dir.includes("/widgets/")
      ? `widget/${dir.split("/").pop() ?? ""}`
      : dir.includes("/integrations/")
        ? `integration/${dir.split("/").pop() ?? ""}`
        : "";

  // Count non-workspace external deps
  const externalDeps = Object.keys(deps).filter(
    (d) => !d.startsWith("@radarboard/") && d !== "react" && d !== "react-dom"
  );

  if (externalDeps.length > 6 && !EXTERNAL_DEP_WARNING_EXCEPTIONS.has(extensionKey)) {
    results.push({
      name: "external dependency count",
      status: "warn",
      message: `Has ${externalDeps.length} external dependencies (${externalDeps.join(", ")}) — review if all are needed`,
    });
  } else {
    results.push({ name: "external dependency count", status: "pass" });
  }

  // Check for known large deps
  const largeDepsFound = externalDeps.filter((d) => LARGE_DEPS.has(d));
  if (largeDepsFound.length > 0) {
    results.push({
      name: "large dependencies",
      status: "warn",
      message: `Uses large packages: ${largeDepsFound.join(", ")} — consider lighter alternatives`,
    });
  }

  return results;
}

function checkDescriptorQuality(dir: string, category: ExtensionCategory): CheckResult[] {
  const results: CheckResult[] = [];

  // Try to read the entry file and check for descriptor-like content
  const pkgJsonPath = join(dir, "package.json");
  if (!existsSync(pkgJsonPath)) return results;

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  const entryPath = pkg.exports?.["."];
  if (!entryPath) return results;

  const resolvedEntry = join(dir, entryPath);
  if (!existsSync(resolvedEntry)) return results;

  const content = readFileSync(resolvedEntry, "utf8");

  // Check that the entry exports a descriptor
  const descriptorPatterns: Record<ExtensionCategory, RegExp> = {
    integration: /export\s+(?:const|let)\s+\w+Descriptor/,
    plugin: /export\s+(?:const|let)\s+\w+Descriptor/,
    widget: /export\s+(?:const|let)\s+\w+Descriptor/,
  };

  if (!descriptorPatterns[category].test(content)) {
    // For virtual integrations, they export data sources instead
    if (category === "integration" && VIRTUAL_INTEGRATIONS.has(dir.split("/").pop() ?? "")) {
      results.push({ name: "descriptor export", status: "pass" });
    } else if (category === "integration") {
      results.push({
        name: "descriptor export",
        status: "warn",
        message: "No descriptor export found in entry file (OK for virtual integrations)",
      });
    } else {
      results.push({
        name: "descriptor export",
        status: "error",
        message: "Entry file does not export a descriptor (expected export const <name>Descriptor)",
      });
    }
  } else {
    results.push({ name: "descriptor export", status: "pass" });
  }

  return results;
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const srcDir = join(dir, "src");
  const targetDir = existsSync(srcDir) ? srcDir : dir;

  try {
    walkDir(targetDir, files);
  } catch {
    // Directory might not exist
  }
  return files;
}

function walkDir(dir: string, files: string[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".turbo") continue;
      walkDir(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec|stories)\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

function findFiles(dir: string, pattern: RegExp): string[] {
  const files: string[] = [];
  try {
    walkDirAll(dir, files, pattern);
  } catch {
    // Directory might not exist
  }
  return files;
}

function walkDirAll(dir: string, files: string[], pattern: RegExp) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".turbo") continue;
      walkDirAll(fullPath, files, pattern);
    } else if (pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const filterCategory = args.find((a) => a.startsWith("--filter="))?.split("=")[1]
    ?? (args.includes("--filter") ? args[args.indexOf("--filter") + 1] : undefined);
  const verbose = args.includes("--verbose");

  const config = await loadConfig();

  const extensions: { pkg: string; category: ExtensionCategory; dir: string; id: string }[] = [];

  // Collect all active extensions
  if (!filterCategory || filterCategory === "integration") {
    for (const pkg of [...config.integrations, ...config.virtualIntegrations]) {
      const id = extractId(pkg, "@radarboard/integration-");
      extensions.push({ pkg, category: "integration", dir: join(ROOT, "integrations", id), id });
    }
  }
  if (!filterCategory || filterCategory === "plugin") {
    for (const pkg of config.plugins) {
      const id = extractId(pkg, "@radarboard/plugin-");
      extensions.push({ pkg, category: "plugin", dir: join(ROOT, "plugins", id), id });
    }
  }
  if (!filterCategory || filterCategory === "widget") {
    for (const pkg of config.widgets) {
      const id = extractId(pkg, "@radarboard/widget-");
      extensions.push({ pkg, category: "widget", dir: join(ROOT, "widgets", id), id });
    }
  }

  const reports: ExtensionReport[] = [];

  for (const ext of extensions) {
    const checks: CheckResult[] = [
      ...checkPackageStructure(ext.dir, ext.category, ext.id),
      ...checkExportValidation(ext.dir),
      ...checkModuleBoundaries(ext.dir, ext.category, ext.id),
      ...checkTestExistence(ext.dir, ext.category),
      ...checkBundleImpact(ext.dir),
      ...checkDescriptorQuality(ext.dir, ext.category),
    ];
    reports.push({ id: ext.id, category: ext.category, packageDir: ext.dir, checks });
  }

  if (!filterCategory || filterCategory === "integration" || filterCategory === "widget") {
    const capabilityAudits = await loadCapabilityAudits();
    for (const audit of capabilityAudits) {
      if (audit.integrationId) {
        reports
          .filter((report) => report.category === "integration" && report.id === audit.integrationId)
          .forEach((report) =>
            report.checks.push({
              name: "capability governance",
              status: audit.level,
              message: audit.message,
            })
          );
      }

      if (audit.widgetId) {
        reports
          .filter((report) => report.category === "widget" && report.id === audit.widgetId)
          .forEach((report) =>
            report.checks.push({
              name: "capability governance",
              status: audit.level,
              message: audit.message,
            })
          );
      }
    }
  }

  // Output results
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalPassed = 0;

  console.log("\n╭─────────────────────────────────────────────────╮");
  console.log("│         Extension Quality Check Report          │");
  console.log("╰─────────────────────────────────────────────────╯\n");

  for (const report of reports) {
    const errors = report.checks.filter((c) => c.status === "error");
    const warnings = report.checks.filter((c) => c.status === "warn");
    const passed = report.checks.filter((c) => c.status === "pass");

    totalErrors += errors.length;
    totalWarnings += warnings.length;
    totalPassed += passed.length;

    const icon = errors.length > 0 ? "\x1b[31m✗\x1b[0m" : warnings.length > 0 ? "\x1b[33m⚠\x1b[0m" : "\x1b[32m✓\x1b[0m";
    console.log(`${icon} ${report.category}/${report.id} — ${passed.length} passed, ${warnings.length} warnings, ${errors.length} errors`);

    for (const check of errors) {
      console.log(`  \x1b[31m✗ ${check.name}: ${check.message}\x1b[0m`);
    }
    for (const check of warnings) {
      console.log(`  \x1b[33m⚠ ${check.name}: ${check.message}\x1b[0m`);
    }
    if (verbose) {
      for (const check of passed) {
        console.log(`  \x1b[32m✓ ${check.name}\x1b[0m`);
      }
    }
  }

  // Summary
  console.log("\n─────────────────────────────────────────────────");
  console.log(`Extensions checked: ${reports.length}`);
  console.log(`\x1b[32m✓ ${totalPassed} passed\x1b[0m  \x1b[33m⚠ ${totalWarnings} warnings\x1b[0m  \x1b[31m✗ ${totalErrors} errors\x1b[0m`);
  console.log("─────────────────────────────────────────────────\n");

  if (totalErrors > 0) {
    console.error(`\x1b[31mQuality check failed with ${totalErrors} error(s).\x1b[0m`);
    process.exit(1);
  }

  if (totalWarnings > 0) {
    console.log(`\x1b[33m${totalWarnings} warning(s) found — consider addressing these.\x1b[0m`);
  }

  console.log("\x1b[32mAll quality checks passed.\x1b[0m");
}

main().catch((err) => {
  console.error("Quality check failed:", err);
  process.exit(1);
});
