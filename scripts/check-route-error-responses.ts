#!/usr/bin/env tsx

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Node, Project, SyntaxKind, type CallExpression, type ObjectLiteralExpression } from "ts-morph";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const BASELINE_PATH = path.join(REPO_ROOT, "scripts/route-error-responses-baseline.txt");
const TARGET_ROOTS = ["apps/app/app/api", "apps/app/modules"] as const;

export function shouldCheckFile(filePath: string): boolean {
  const normalizedPath = filePath.replaceAll(path.sep, "/");

  if (!/\.(?:[cm]?[jt]sx?)$/u.test(normalizedPath)) return false;
  if (
    normalizedPath.endsWith(".d.ts") ||
    normalizedPath.includes(".test.") ||
    normalizedPath.includes(".spec.") ||
    normalizedPath.includes(".stories.") ||
    normalizedPath.includes(".scaffold.")
  ) {
    return false;
  }

  if (normalizedPath.startsWith("apps/app/app/api/")) {
    return normalizedPath.endsWith("/route.ts");
  }

  if (normalizedPath.startsWith("apps/app/modules/")) {
    return normalizedPath.includes("/routes/") && normalizedPath.endsWith(".ts");
  }

  return false;
}

function walkCodeFiles(rootDir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absPath = path.join(rootDir, entry.name);
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

    const relPath = path.relative(REPO_ROOT, absPath).replaceAll(path.sep, "/");
    if (shouldCheckFile(relPath)) {
      files.push(relPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function isNextResponseJsonCall(node: CallExpression): boolean {
  const expression = node.getExpression();
  return (
    Node.isPropertyAccessExpression(expression) &&
    expression.getExpression().getText() === "NextResponse" &&
    expression.getName() === "json"
  );
}

function hasErrorProperty(node: ObjectLiteralExpression): boolean {
  return node.getProperties().some((property) => {
    if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) {
      return false;
    }

    return property.getName() === "error";
  });
}

function hasFalseStatusFlag(node: ObjectLiteralExpression): boolean {
  return node.getProperties().some((property) => {
    if (!Node.isPropertyAssignment(property)) {
      return false;
    }

    const name = property.getName();
    if (name !== "ok" && name !== "success" && name !== "imported") {
      return false;
    }

    return property.getInitializer()?.getText() === "false";
  });
}

export function collectViolationsFromSource(filePath: string, sourceText: string): string[] {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(filePath, sourceText);
  const violations: string[] = [];

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (!isNextResponseJsonCall(call)) continue;

    const [firstArg] = call.getArguments();
    if (!firstArg || !Node.isObjectLiteralExpression(firstArg) || !hasErrorProperty(firstArg)) {
      continue;
    }

    const hasStatusArgument = call.getArguments().length > 1;
    if (!hasStatusArgument && !hasFalseStatusFlag(firstArg)) {
      continue;
    }

    const line = call.getStartLineNumber();
    violations.push(
      `${filePath}:${line} - Manual NextResponse.json error response. Throw ApiRouteError helpers and wrap with handleRoute().`
    );
  }

  return violations;
}

function collectViolationsForFile(filePath: string): string[] {
  const absolutePath = path.join(REPO_ROOT, filePath);
  const sourceText = readFileSync(absolutePath, "utf8");
  return collectViolationsFromSource(filePath, sourceText);
}

function readBaseline(): Set<string> {
  if (!existsSync(BASELINE_PATH)) {
    return new Set();
  }

  const source = readFileSync(BASELINE_PATH, "utf8").trim();
  if (!source) {
    return new Set();
  }

  return new Set(source.split("\n").filter(Boolean));
}

function writeBaseline(): void {
  const violations = TARGET_ROOTS.flatMap((root) => walkCodeFiles(path.join(REPO_ROOT, root)))
    .flatMap(collectViolationsForFile)
    .sort((left, right) => left.localeCompare(right));

  writeFileSync(BASELINE_PATH, `${violations.join("\n")}\n`, "utf8");
  console.log(`Wrote ${violations.length} route error baseline entries to ${BASELINE_PATH}`);
}

function main(): void {
  if (process.argv.includes("--write-baseline")) {
    writeBaseline();
    return;
  }

  const baseline = readBaseline();
  const violations = TARGET_ROOTS.flatMap((root) => walkCodeFiles(path.join(REPO_ROOT, root)))
    .flatMap(collectViolationsForFile)
    .filter((violation) => !baseline.has(violation));

  if (violations.length === 0) {
    console.log("✓ route handlers do not introduce new manual NextResponse.json error responses");
    return;
  }

  console.error("\nManual route error responses found:\n");
  for (const violation of violations) {
    console.error(violation);
  }
  console.error(
    "\nUse throw helpers from @/lib/api (for example badRequest/notFound/internalError) and wrap route handlers with handleRoute()."
  );
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
