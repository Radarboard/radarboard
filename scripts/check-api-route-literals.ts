#!/usr/bin/env tsx
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const TARGET_ROOTS = ["apps/app", "features", "integrations", "packages", "plugins", "widgets"];
const CANONICAL_ROUTE_FILE = "packages/types/src/api-routes.ts";

const PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "fetch", regex: /\bfetch\(\s*["'`]\/api\// },
  { label: "EventSource", regex: /\bEventSource\(\s*["'`]\/api\// },
  { label: "sendBeacon", regex: /\bsendBeacon\(\s*["'`]\/api\// },
  { label: "transport api", regex: /\bapi:\s*["'`]\/api\// },
  { label: "callApi", regex: /\bcallApi\(\s*["'`]\/api\// },
  { label: "withLogging", regex: /\bwithLogging\(\s*["'`]\/?api\// },
];

let failed = false;

function fail(message: string) {
  console.error(`✗ ${message}`);
  failed = true;
}

function pass(message: string) {
  console.log(`✓ ${message}`);
}

function walkCodeFiles(rootDir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".next-dev" ||
        entry.name === ".next-e2e" ||
        entry.name === ".turbo" ||
        entry.name === "dist"
      ) {
        continue;
      }
      files.push(...walkCodeFiles(absPath));
      continue;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(absPath);
    }
  }
  return files;
}

function shouldSkip(relPath: string): boolean {
  return (
    relPath === CANONICAL_ROUTE_FILE ||
    relPath.startsWith("apps/app/app/api/") ||
    relPath.includes("/__tests__/") ||
    relPath.includes("/__stories__/") ||
    relPath.includes("/_template/") ||
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(relPath)
  );
}

function isCommentOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length === 0 ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("*/")
  );
}

function main() {
  const violations: string[] = [];

  for (const root of TARGET_ROOTS) {
    const absRoot = resolve(ROOT, root);
    for (const absFile of walkCodeFiles(absRoot)) {
      const relPath = relative(ROOT, absFile);
      if (shouldSkip(relPath)) continue;

      const content = readFileSync(absFile, "utf8");
      const lines = content.split("\n");

      for (const [index, line] of lines.entries()) {
        if (isCommentOnlyLine(line)) continue;

        const match = PATTERNS.find(({ regex }) => regex.test(line));
        if (!match) continue;

        violations.push(`${relPath}:${index + 1} — raw ${match.label} /api string`);
      }
    }
  }

  if (violations.length > 0) {
    for (const violation of violations) {
      fail(violation);
    }
  } else {
    pass("network API call sites use centralized route constants/helpers");
  }

  if (failed) {
    process.exit(1);
  }
}

main();
