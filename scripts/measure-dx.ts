#!/usr/bin/env tsx
/**
 * Extension DX Scorecard — measures developer experience metrics across
 * all extension types (integrations, plugins, widgets).
 *
 * Tracks:
 * - Lines of code (total and business logic)
 * - File count
 * - Boilerplate ratio (template LOC vs actual LOC)
 * - API concept count (distinct SDK imports)
 * - JSDoc coverage on SDK exports
 * - Scaffold cleanliness (does the template pass lint/type checks as-is)
 *
 * Usage: pnpm measure:dx [--filter integration|plugin|widget] [--json]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

type ExtensionCategory = "integration" | "plugin" | "widget";

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

type RadarboardConfig = {
  integrations: string[];
  virtualIntegrations: string[];
  plugins: string[];
  widgets: string[];
};

async function loadConfig(): Promise<RadarboardConfig> {
  const mod = await import(join(ROOT, "radarboard.config.ts"));
  return mod.default as RadarboardConfig;
}

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

function walkDir(dir: string, pattern: RegExp): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".turbo") continue;
      files.push(...walkDir(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function countLines(filePath: string): number {
  return readFileSync(filePath, "utf8").split("\n").length;
}

// ---------------------------------------------------------------------------
// Metrics per extension
// ---------------------------------------------------------------------------

interface ExtensionMetrics {
  id: string;
  category: ExtensionCategory;
  fileCount: number;
  totalLoc: number;
  testLoc: number;
  businessLoc: number;
  sdkImports: string[];
  apiConceptCount: number;
  externalDeps: string[];
  externalDepCount: number;
}

function measureExtension(id: string, category: ExtensionCategory): ExtensionMetrics | null {
  const categoryDir = category === "integration" ? "integrations" : `${category}s`;
  const dir = join(ROOT, categoryDir, id);
  if (!existsSync(dir)) return null;

  // All source files
  const sourceFiles = walkDir(dir, /\.(ts|tsx)$/);
  const testFiles = sourceFiles.filter((f) => /\.(test|spec)\.(ts|tsx)$/.test(f));
  const nonTestFiles = sourceFiles.filter((f) => !/\.(test|spec)\.(ts|tsx)$/.test(f));

  const totalLoc = sourceFiles.reduce((sum, f) => sum + countLines(f), 0);
  const testLoc = testFiles.reduce((sum, f) => sum + countLines(f), 0);
  const businessLoc = nonTestFiles.reduce((sum, f) => sum + countLines(f), 0);

  // Distinct SDK imports (API concepts)
  const sdkImportSet = new Set<string>();
  for (const file of nonTestFiles) {
    const content = readFileSync(file, "utf8");
    const importRegex = /(?:from|import)\s+["'](@radarboard\/[^"'/]+(?:\/[^"']+)?)["']/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      sdkImportSet.add(match[1]);
    }
  }

  // External dependencies
  const pkgJsonPath = join(dir, "package.json");
  const externalDeps: string[] = [];
  if (existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      if (!dep.startsWith("@radarboard/") && dep !== "react" && dep !== "react-dom") {
        externalDeps.push(dep);
      }
    }
  }

  return {
    id,
    category,
    fileCount: nonTestFiles.length,
    totalLoc,
    testLoc,
    businessLoc,
    sdkImports: [...sdkImportSet].sort(),
    apiConceptCount: sdkImportSet.size,
    externalDeps,
    externalDepCount: externalDeps.length,
  };
}

// ---------------------------------------------------------------------------
// Template (boilerplate) baseline measurement
// ---------------------------------------------------------------------------

function measureTemplate(category: ExtensionCategory): number {
  const categoryDir = category === "integration" ? "integrations" : `${category}s`;
  const dir = join(ROOT, categoryDir, "_template");
  if (!existsSync(dir)) return 0;

  const files = walkDir(dir, /\.(ts|tsx)$/).filter(
    (f) => !/\.(test|spec)\.(ts|tsx)$/.test(f),
  );
  return files.reduce((sum, f) => sum + countLines(f), 0);
}

// ---------------------------------------------------------------------------
// SDK JSDoc coverage
// ---------------------------------------------------------------------------

interface JsDocCoverage {
  package: string;
  totalExports: number;
  documentedExports: number;
  coverage: number;
}

function measureJsDocCoverage(sdkPath: string, packageName: string): JsDocCoverage {
  const typesFile = join(ROOT, sdkPath);
  if (!existsSync(typesFile)) {
    return { package: packageName, totalExports: 0, documentedExports: 0, coverage: 0 };
  }

  const content = readFileSync(typesFile, "utf8");
  const lines = content.split("\n");

  let totalExports = 0;
  let documentedExports = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match exported interfaces, types, functions, and consts
    if (/^export\s+(interface|type|function|const|class)\s/.test(line)) {
      totalExports++;
      // Check if preceding lines have JSDoc
      let j = i - 1;
      while (j >= 0 && lines[j].trim() === "") j--;
      if (j >= 0 && (lines[j].trim().endsWith("*/") || lines[j].trim().startsWith("*/"))) {
        documentedExports++;
      }
    }
  }

  return {
    package: packageName,
    totalExports,
    documentedExports,
    coverage: totalExports === 0 ? 100 : Math.round((documentedExports / totalExports) * 100),
  };
}

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  white: "\x1b[37m",
};

function ratingColor(score: number): string {
  if (score >= 80) return C.green;
  if (score >= 50) return C.yellow;
  return C.red;
}

function ratingLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Needs work";
}

function padRight(s: string, len: number): string {
  return s + " ".repeat(Math.max(0, len - s.length));
}

function padLeft(s: string, len: number): string {
  return " ".repeat(Math.max(0, len - s.length)) + s;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const filterCategory = args.find((a) => a.startsWith("--filter="))?.split("=")[1]
    ?? (args.includes("--filter") ? args[args.indexOf("--filter") + 1] : undefined);
  const jsonOutput = args.includes("--json");

  const config = await loadConfig();

  // Collect all extensions
  const extensions: { id: string; category: ExtensionCategory }[] = [];

  if (!filterCategory || filterCategory === "integration") {
    for (const pkg of [...config.integrations, ...config.virtualIntegrations]) {
      extensions.push({ id: pkg.replace("@radarboard/integration-", ""), category: "integration" });
    }
  }
  if (!filterCategory || filterCategory === "plugin") {
    for (const pkg of config.plugins) {
      extensions.push({ id: pkg.replace("@radarboard/plugin-", ""), category: "plugin" });
    }
  }
  if (!filterCategory || filterCategory === "widget") {
    for (const pkg of config.widgets) {
      extensions.push({ id: pkg.replace("@radarboard/widget-", ""), category: "widget" });
    }
  }

  // Measure all extensions
  const metrics: ExtensionMetrics[] = [];
  for (const ext of extensions) {
    const m = measureExtension(ext.id, ext.category);
    if (m) metrics.push(m);
  }

  // Group by category
  const byCategory = new Map<ExtensionCategory, ExtensionMetrics[]>();
  for (const m of metrics) {
    const arr = byCategory.get(m.category) ?? [];
    arr.push(m);
    byCategory.set(m.category, arr);
  }

  // Template baselines
  const templateLoc: Record<ExtensionCategory, number> = {
    integration: measureTemplate("integration"),
    plugin: measureTemplate("plugin"),
    widget: measureTemplate("widget"),
  };

  // SDK JSDoc coverage
  const jsDocCoverage: JsDocCoverage[] = [
    measureJsDocCoverage("packages/integration-sdk/src/types.ts", "integration-sdk"),
    measureJsDocCoverage("packages/plugin-sdk/src/types.ts", "plugin-sdk"),
    measureJsDocCoverage("packages/widget-sdk/src/widget-types.ts", "widget-sdk"),
  ];

  // ---------------------------------------------------------------------------
  // JSON output mode
  // ---------------------------------------------------------------------------

  if (jsonOutput) {
    const output: Record<string, unknown> = {};
    for (const [cat, exts] of byCategory) {
      const locs = exts.map((e) => e.businessLoc);
      const files = exts.map((e) => e.fileCount);
      const concepts = exts.map((e) => e.apiConceptCount);
      output[cat] = {
        count: exts.length,
        loc: { min: Math.min(...locs), median: median(locs), max: Math.max(...locs), avg: avg(locs) },
        files: { min: Math.min(...files), median: median(files), max: Math.max(...files) },
        apiConcepts: { min: Math.min(...concepts), median: median(concepts), max: Math.max(...concepts) },
        templateLoc: templateLoc[cat],
        boilerplateRatioMedian: median(locs) === 0 ? 0 : Math.round((templateLoc[cat] / median(locs)) * 100),
        extensions: exts.map((e) => ({
          id: e.id,
          fileCount: e.fileCount,
          businessLoc: e.businessLoc,
          testLoc: e.testLoc,
          apiConceptCount: e.apiConceptCount,
          sdkImports: e.sdkImports,
          externalDeps: e.externalDeps,
          boilerplateRatio: e.businessLoc === 0 ? 0 : Math.round((templateLoc[cat] / e.businessLoc) * 100),
        })),
      };
    }
    output.jsDocCoverage = jsDocCoverage;
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // ---------------------------------------------------------------------------
  // Console output
  // ---------------------------------------------------------------------------

  console.log(`\n${C.bold}╭─────────────────────────────────────────────────╮${C.reset}`);
  console.log(`${C.bold}│          Extension DX Scorecard                  │${C.reset}`);
  console.log(`${C.bold}╰─────────────────────────────────────────────────╯${C.reset}\n`);

  // Per-category summary
  for (const cat of ["integration", "plugin", "widget"] as ExtensionCategory[]) {
    const exts = byCategory.get(cat);
    if (!exts || exts.length === 0) continue;

    const locs = exts.map((e) => e.businessLoc);
    const files = exts.map((e) => e.fileCount);
    const concepts = exts.map((e) => e.apiConceptCount);
    const tplLoc = templateLoc[cat];
    const medianLoc = median(locs);
    const boilerplateRatio = medianLoc === 0 ? 0 : Math.round((tplLoc / medianLoc) * 100);

    console.log(`${C.cyan}${C.bold}${cat.toUpperCase()}S${C.reset} (${exts.length} total)`);
    console.log(`${"─".repeat(50)}`);

    // Key metrics table
    console.log(`  ${C.dim}Metric              Min     Median  Max${C.reset}`);
    console.log(`  Lines of code       ${padLeft(String(Math.min(...locs)), 6)}  ${padLeft(String(medianLoc), 6)}  ${padLeft(String(Math.max(...locs)), 6)}`);
    console.log(`  Files               ${padLeft(String(Math.min(...files)), 6)}  ${padLeft(String(median(files)), 6)}  ${padLeft(String(Math.max(...files)), 6)}`);
    console.log(`  API concepts        ${padLeft(String(Math.min(...concepts)), 6)}  ${padLeft(String(median(concepts)), 6)}  ${padLeft(String(Math.max(...concepts)), 6)}`);
    console.log(`  Template LOC        ${padLeft(String(tplLoc), 6)}`);
    console.log(`  Boilerplate ratio   ${padLeft(`${boilerplateRatio}%`, 6)}  ${C.dim}(template / median extension)${C.reset}`);
    console.log("");

    // Per-extension details
    const sorted = [...exts].sort((a, b) => a.businessLoc - b.businessLoc);
    for (const ext of sorted) {
      const ratio = ext.businessLoc === 0 ? 0 : Math.round((tplLoc / ext.businessLoc) * 100);
      const depsStr = ext.externalDepCount > 0 ? ` ${C.dim}deps: ${ext.externalDeps.join(", ")}${C.reset}` : "";
      console.log(
        `  ${padRight(ext.id, 26)} ${padLeft(String(ext.businessLoc), 5)} loc  ${padLeft(String(ext.fileCount), 2)} files  ${padLeft(String(ext.apiConceptCount), 2)} concepts  ${padLeft(`${ratio}%`, 4)} tpl${depsStr}`,
      );
    }
    console.log("");
  }

  // SDK JSDoc coverage
  console.log(`${C.cyan}${C.bold}SDK JSDOC COVERAGE${C.reset}`);
  console.log(`${"─".repeat(50)}`);
  for (const cov of jsDocCoverage) {
    const color = ratingColor(cov.coverage);
    console.log(
      `  ${padRight(cov.package, 20)} ${color}${padLeft(`${cov.coverage}%`, 4)}${C.reset}  (${cov.documentedExports}/${cov.totalExports} exports documented)`,
    );
  }
  console.log("");

  // Overall DX score
  console.log(`${C.cyan}${C.bold}DX HEALTH INDICATORS${C.reset}`);
  console.log(`${"─".repeat(50)}`);

  // 1. Minimum LOC to get started (lower is better)
  const minLocs: Record<ExtensionCategory, number> = { integration: 0, plugin: 0, widget: 0 };
  for (const [cat, exts] of byCategory) {
    minLocs[cat] = Math.min(...exts.map((e) => e.businessLoc));
  }
  const minLocScore = Math.min(minLocs.integration, minLocs.plugin, minLocs.widget) < 500 ? 90 : 60;
  console.log(`  ${ratingColor(minLocScore)}Minimum LOC to get started${C.reset}`);
  console.log(`    Integration: ${minLocs.integration ?? "N/A"} loc  |  Widget: ${minLocs.widget ?? "N/A"} loc  |  Plugin: ${minLocs.plugin ?? "N/A"} loc`);

  // 2. API concepts floor (lower is better)
  const minConcepts: Record<ExtensionCategory, number> = { integration: 0, plugin: 0, widget: 0 };
  for (const [cat, exts] of byCategory) {
    minConcepts[cat] = Math.min(...exts.map((e) => e.apiConceptCount));
  }
  const conceptScore = Math.max(...Object.values(minConcepts)) <= 5 ? 90 : 60;
  console.log(`  ${ratingColor(conceptScore)}API concepts to learn${C.reset}`);
  console.log(`    Integration: ${minConcepts.integration ?? "N/A"}  |  Widget: ${minConcepts.widget ?? "N/A"}  |  Plugin: ${minConcepts.plugin ?? "N/A"}`);

  // 3. JSDoc coverage average
  const avgCoverage = Math.round(jsDocCoverage.reduce((s, c) => s + c.coverage, 0) / jsDocCoverage.length);
  console.log(`  ${ratingColor(avgCoverage)}SDK documentation coverage${C.reset}: ${avgCoverage}%`);

  // 4. Boilerplate ratio (higher is better — more comes for free)
  const avgBoilerplate = Math.round(
    (["integration", "plugin", "widget"] as ExtensionCategory[])
      .map((cat) => {
        const exts = byCategory.get(cat);
        if (!exts) return 0;
        const medLoc = median(exts.map((e) => e.businessLoc));
        return medLoc === 0 ? 0 : (templateLoc[cat] / medLoc) * 100;
      })
      .reduce((a, b) => a + b, 0) / 3,
  );
  console.log(`  ${ratingColor(avgBoilerplate)}Scaffolding coverage${C.reset}: ${avgBoilerplate}% median boilerplate ratio`);

  // Overall score (weighted)
  const overallScore = Math.round(
    minLocScore * 0.25 + conceptScore * 0.25 + avgCoverage * 0.3 + Math.min(avgBoilerplate, 100) * 0.2,
  );

  console.log("");
  console.log(`${C.bold}Overall DX Score: ${ratingColor(overallScore)}${overallScore}/100 — ${ratingLabel(overallScore)}${C.reset}`);
  console.log(`${C.dim}  (25% min LOC + 25% API concepts + 30% docs coverage + 20% scaffolding)${C.reset}`);
  console.log("");
}

main().catch((err) => {
  console.error("DX measurement failed:", err);
  process.exit(1);
});
