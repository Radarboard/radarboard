import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const componentRoots = [
  "apps/app/components",
  "packages/ui/src",
  "packages/widgets/src/components",
  "packages/plugins/src/components",
] as const;

const ignoredTokens = new Set(["index", "stories", "story", "test", "spec"]);
const baselinePath = path.join(process.cwd(), "scripts/component-name-baseline.txt");
const ignoredFilePattern = /\.(stories|story|scaffold)\.(ts|tsx)$/;

function getStagedPaths(): string[] {
  const output = execSync("git diff --cached --name-only --diff-filter=ACR", {
    encoding: "utf8",
  }).trim();

  return output ? output.split("\n").filter(Boolean) : [];
}

function isComponentPath(filePath: string): boolean {
  if (
    ignoredFilePattern.test(filePath) ||
    filePath.includes("/__tests__/") ||
    filePath.includes("/__stories__/") ||
    filePath.includes("/__snapshots__/")
  ) {
    return false;
  }

  return componentRoots.some(
    (root) => filePath === root || filePath.startsWith(`${root}/`)
  );
}

function splitWords(token: string): string[] {
  return token
    .split(/[-_]+/g)
    .flatMap((part) => part.split(/(?=[A-Z])/g))
    .map((part) => part.trim())
    .filter(Boolean);
}

function validateSegment(segment: string): string | null {
  if (!segment || segment.startsWith(".") || segment.startsWith("[")) {
    return null;
  }

  const words = splitWords(segment);
  return words.length > 2 ? `${segment} (${words.length} words)` : null;
}

function validateFileName(filePath: string): string[] {
  const ext = path.extname(filePath);
  const withoutExt = path.basename(filePath, ext);
  const tokens = withoutExt.split(".").filter((token) => !ignoredTokens.has(token));
  const violations: string[] = [];

  for (const token of tokens) {
    const violation = validateSegment(token);
    if (violation) {
      violations.push(violation);
    }
  }

  return violations;
}

function collectViolations(filePaths: string[]): string[] {
  const failures: string[] = [];

  for (const filePath of filePaths) {
    const segments = filePath.split("/").slice(0, -1);
    for (const segment of segments) {
      const violation = validateSegment(segment);
      if (violation) {
        failures.push(`${filePath}: path segment ${violation}`);
      }
    }

    for (const violation of validateFileName(filePath)) {
      failures.push(`${filePath}: file token ${violation}`);
    }
  }

  return failures;
}

function walkFiles(root: string, files: string[]) {
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    const nextPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(nextPath, files);
    } else {
      files.push(path.relative(process.cwd(), nextPath));
    }
  }
}

function getAllComponentPaths(): string[] {
  const files: string[] = [];

  for (const root of componentRoots) {
    const absoluteRoot = path.join(process.cwd(), root);
    if (fs.existsSync(absoluteRoot)) {
      walkFiles(absoluteRoot, files);
    }
  }

  return files;
}

function readBaseline(): Set<string> {
  if (!fs.existsSync(baselinePath)) {
    return new Set();
  }

  const source = fs.readFileSync(baselinePath, "utf8").trim();
  if (!source) {
    return new Set();
  }

  return new Set(source.split("\n").filter(Boolean));
}

function writeBaseline() {
  const violations = collectViolations(getAllComponentPaths()).sort();
  fs.writeFileSync(baselinePath, `${violations.join("\n")}\n`);
  console.log(`Wrote ${violations.length} component-name baseline entries to ${baselinePath}`);
}

function main() {
  if (process.argv.includes("--write-baseline")) {
    writeBaseline();
    return;
  }

  const stagedPaths = getStagedPaths().filter(isComponentPath);
  const baseline = readBaseline();
  const failures = collectViolations(stagedPaths).filter((failure) => !baseline.has(failure));

  if (failures.length > 0) {
    console.error("Component naming rule failed.");
    console.error("Use at most 2 words for component path segments and file tokens.");
    console.error("Existing repo debt may live in scripts/component-name-baseline.txt.");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
}

main();
