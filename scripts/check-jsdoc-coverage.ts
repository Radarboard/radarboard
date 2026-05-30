import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Enforces minimum JSDoc coverage on exported interfaces, types, and functions
 * in SDK packages. Extensions depend on these SDKs, so docs are critical for DX.
 *
 * Checks: integration-sdk, plugin-sdk, widget-sdk, widget-engine
 * Threshold: 70% of exported symbols must have JSDoc.
 */

const ROOT = process.cwd();

/**
 * Per-package thresholds. Ratchet these up over time as coverage improves.
 * The goal is 70% for all SDK packages.
 */
const SDK_PACKAGES: Array<{ path: string; threshold: number }> = [
  { path: "packages/integration-sdk/src", threshold: 95 },
  { path: "packages/plugin-sdk/src", threshold: 70 },
  { path: "packages/widget-sdk/src", threshold: 70 },
];

const SOURCE_FILE_PATTERN = /\.ts$/;
const EXCLUDED_PATTERN = /\.(test|spec|stories)\.(ts|tsx)$/;
const SKIP_DIR_NAMES = new Set(["node_modules", ".turbo", "coverage", "dist", "__tests__"]);

/** Matches exported interface, type, function, const declarations. */
const EXPORT_PATTERN =
  /^export\s+(?:interface|type|function|const|class|enum)\s+(\w+)/gm;

/** Matches a JSDoc block immediately before an export. */
const JSDOC_BEFORE_EXPORT =
  /\/\*\*[\s\S]*?\*\/\s*\n\s*export\s+(?:interface|type|function|const|class|enum)\s+(\w+)/gm;

function collectFiles(dir: string): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (!SOURCE_FILE_PATTERN.test(entry.name) || EXCLUDED_PATTERN.test(entry.name)) continue;
    files.push(fullPath);
  }

  return files;
}

interface PackageResult {
  name: string;
  totalExports: number;
  documented: number;
  coverage: number;
  undocumented: string[];
}

function analyzePackage(pkgPath: string): PackageResult {
  const absolutePath = join(ROOT, pkgPath);
  const files = collectFiles(absolutePath);
  const allExports = new Set<string>();
  const documentedExports = new Set<string>();
  const undocumented: string[] = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf8");
    const rel = relative(ROOT, filePath);

    // Find all exported symbols
    let match: RegExpExecArray | null;
    const exportRe = new RegExp(EXPORT_PATTERN.source, "gm");
    while ((match = exportRe.exec(content)) !== null) {
      allExports.add(`${rel}:${match[1]}`);
    }

    // Find documented exports
    const docRe = new RegExp(JSDOC_BEFORE_EXPORT.source, "gm");
    while ((match = docRe.exec(content)) !== null) {
      documentedExports.add(`${rel}:${match[1]}`);
    }
  }

  for (const exp of allExports) {
    if (!documentedExports.has(exp)) {
      undocumented.push(exp);
    }
  }

  const coverage = allExports.size > 0 ? Math.round((documentedExports.size / allExports.size) * 100) : 100;

  return {
    name: pkgPath.split("/")[1] ?? pkgPath,
    totalExports: allExports.size,
    documented: documentedExports.size,
    coverage,
    undocumented: undocumented.sort(),
  };
}

function main() {
  const verbose = process.argv.includes("--verbose");
  const results = SDK_PACKAGES.map((pkg) => ({
    ...analyzePackage(pkg.path),
    threshold: pkg.threshold,
  }));
  const failures: Array<PackageResult & { threshold: number }> = [];

  console.log("JSDoc Coverage Report (SDK packages)\n");
  console.log("Package              Exports  Documented  Coverage  Threshold");
  console.log("─".repeat(65));

  for (const r of results) {
    const status = r.coverage >= r.threshold ? "✓" : "✗";
    console.log(
      `${status} ${r.name.padEnd(20)} ${String(r.totalExports).padStart(7)}  ${String(r.documented).padStart(10)}  ${String(r.coverage).padStart(7)}%  ${String(r.threshold).padStart(8)}%`
    );
    if (r.coverage < r.threshold) failures.push(r);
  }

  console.log("");

  if (verbose) {
    for (const r of results) {
      if (r.undocumented.length > 0) {
        console.log(`\nUndocumented exports in ${r.name}:`);
        for (const u of r.undocumented) {
          console.log(`  - ${u}`);
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} SDK package(s) below JSDoc threshold:`
    );
    for (const f of failures) {
      console.error(`  ${f.name}: ${f.coverage}% (need ${f.threshold}%)`);
    }
    console.error("\nRun with --verbose to see undocumented exports.");
    console.error("Ratchet thresholds up in scripts/check-jsdoc-coverage.ts as you add docs.");
    process.exit(1);
  }

  console.log("All SDK packages meet their JSDoc coverage thresholds.");
}

main();
