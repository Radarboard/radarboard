#!/usr/bin/env tsx

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const APP_ROOT = path.join(REPO_ROOT, "apps/app");
const APP_CHECK_ROOTS = [
  "apps/app/app/",
  "apps/app/components/",
  "apps/app/hooks/",
  "apps/app/lib/",
] as const;
const baselinePath = path.join(REPO_ROOT, "scripts/app-alias-imports-baseline.txt");

const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[^"'`]+\s+from\s+)?["']([^"'`]+)["']/g;

function shouldCheckFile(filePath: string): boolean {
  const normalizedPath = filePath.replaceAll(path.sep, "/");

  if (!APP_CHECK_ROOTS.some((root) => normalizedPath.startsWith(root))) {
    return false;
  }

  if (!/\.(?:[cm]?[jt]sx?)$/u.test(normalizedPath)) {
    return false;
  }

  return !(
    normalizedPath.endsWith(".d.ts") ||
    normalizedPath.includes(".test.") ||
    normalizedPath.includes(".spec.") ||
    normalizedPath.includes(".stories.") ||
    normalizedPath.includes(".scaffold.")
  );
}

function buildAliasSuggestion(filePath: string, importPath: string): string | null {
  const resolvedTarget = path.resolve(path.dirname(path.join(REPO_ROOT, filePath)), importPath);
  const relativeToAppRoot = path.relative(APP_ROOT, resolvedTarget).replaceAll(path.sep, "/");

  if (relativeToAppRoot.startsWith("..")) {
    return null;
  }

  return `@/${relativeToAppRoot}`;
}

function collectViolationsForFile(filePath: string): string[] {
  const content = readFileSync(path.join(REPO_ROOT, filePath), "utf8");
  const errors: string[] = [];

  for (const [index, line] of content.split("\n").entries()) {
    IMPORT_PATTERN.lastIndex = 0;

    for (const match of line.matchAll(IMPORT_PATTERN)) {
      const importPath = match[1];
      if (!importPath?.startsWith("../../")) {
        continue;
      }

      const suggestion = buildAliasSuggestion(filePath, importPath);
      if (!suggestion) {
        continue;
      }

      errors.push(
        `${filePath}:${index + 1} - Use app alias instead of deep relative import: "${importPath}" -> "${suggestion}"`
      );
    }
  }

  return errors;
}

function readBaseline(): Set<string> {
  if (!existsSync(baselinePath)) {
    return new Set();
  }

  const source = readFileSync(baselinePath, "utf8").trim();
  if (!source) {
    return new Set();
  }

  return new Set(source.split("\n").filter(Boolean));
}

function getAllAppFiles(): string[] {
  const files: string[] = [];

  for (const root of APP_CHECK_ROOTS) {
    const absoluteRoot = path.join(REPO_ROOT, root);
    if (!existsSync(absoluteRoot)) {
      continue;
    }

    const stack = [absoluteRoot];
    while (stack.length > 0) {
      const currentDir = stack.pop();
      if (!currentDir) continue;

      for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
        const nextPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          stack.push(nextPath);
        } else {
          const relativePath = path.relative(REPO_ROOT, nextPath).replaceAll(path.sep, "/");
          if (shouldCheckFile(relativePath)) {
            files.push(relativePath);
          }
        }
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function writeBaseline(): void {
  const violations = getAllAppFiles()
    .flatMap(collectViolationsForFile)
    .sort((left, right) => left.localeCompare(right));

  writeFileSync(baselinePath, `${violations.join("\n")}\n`, "utf8");
  console.log(`Wrote ${violations.length} app alias baseline entries to ${baselinePath}`);
}

function main() {
  if (process.argv.includes("--write-baseline")) {
    writeBaseline();
    return;
  }

  const files = process.argv.slice(2).filter(shouldCheckFile);
  if (files.length === 0) {
    return;
  }

  const baseline = readBaseline();
  const errors = files.flatMap(collectViolationsForFile).filter((error) => !baseline.has(error));
  if (errors.length === 0) {
    return;
  }

  console.error("\nApp alias import violations found:\n");
  for (const error of errors) {
    console.error(error);
  }
  console.error("\nUse @/ aliases for deep imports inside apps/app app surfaces.");
  process.exit(1);
}

main();
