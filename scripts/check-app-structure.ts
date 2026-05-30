#!/usr/bin/env tsx
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const APP_ROOT = "apps/app";
const MAX_DIRECT_FILES = 7;
const SKIP_DIR_NAMES = new Set([
  ".devlogs",
  ".next",
  ".next-dev",
  ".next-e2e",
  ".radarboard-data",
  ".radarboard-e2e",
  ".turbo",
  "node_modules",
  "public",
]);

const ZERO_ROOT_FILE_DIRS = [
  "apps/app/components",
  "apps/app/hooks",
  "apps/app/data",
] as const;

const DIRECT_FILE_BUDGET_EXEMPT_DIRS = new Set(["apps/app", "apps/app/modules/settings-shell"]);
const DIRECT_FILE_BUDGET_EXEMPT_NAMES = new Set(["__stories__", "__tests__", "routes"]);

const REQUIRED_DIRS = [
  "apps/app/components/system",
  "apps/app/modules/settings/store",
  "apps/app/modules/provider-shell",
  "apps/app/hooks/app",
  "apps/app/hooks/dashboard",
  "apps/app/hooks/desktop",
  "apps/app/hooks/plugins",
  "apps/app/hooks/projects",
  "apps/app/hooks/settings",
  "apps/app/data/core",
  "apps/app/data/cache",
  "apps/app/data/credentials",
  "apps/app/data/debug",
  "apps/app/data/extensions",
  "apps/app/data/llm",
  "apps/app/data/settings",
  "apps/app/data/providers/sqlite",
  "apps/app/lib/auth",
  "apps/app/lib/licensing",
  "apps/app/lib/mcp",
  "apps/app/lib/notifications",
] as const;

let failed = false;

function fail(message: string) {
  console.error(`✗ ${message}`);
  failed = true;
}

function pass(message: string) {
  console.log(`✓ ${message}`);
}

function getRootFiles(relDir: string): string[] {
  const absDir = resolve(ROOT, relDir);
  return readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function walkFiles(relDir: string): string[] {
  const absDir = resolve(ROOT, relDir);
  const files: string[] = [];

  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const absPath = join(absDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(relative(ROOT, absPath)));
      continue;
    }
    files.push(relative(ROOT, absPath));
  }

  return files.sort();
}

function walkDirs(relDir: string): string[] {
  const absDir = resolve(ROOT, relDir);
  const dirs = [relDir];

  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    dirs.push(...walkDirs(relative(ROOT, join(absDir, entry.name))));
  }

  return dirs;
}

function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(filePath);
}

function isStoryFile(filePath: string): boolean {
  return /\.(stories|story)\.(ts|tsx)$/.test(filePath) || /\.scaffold\.stories\.(ts|tsx)$/.test(filePath);
}

function isHookImplementation(filePath: string): boolean {
  return (
    /\.(ts|tsx)$/.test(filePath) &&
    !/\.(test|spec|stories|story|scaffold)\.(ts|tsx)$/.test(filePath)
  );
}

function main() {
  if (existsSync(resolve(ROOT, "apps/app/db"))) {
    fail("`apps/app/db` should not exist; use `apps/app/data`.");
  } else {
    pass("legacy `apps/app/db` root removed");
  }

  // Enforce the catch-all dispatcher invariant:
  // app/api/ must only contain the [...path] catch-all and the mcp/tools.ts utility.
  // All route logic must live in modules/{feature}-shell/routes/.
  const ALLOWED_API_FILES = new Set([
    "apps/app/app/api/[...path]/route.ts",
    "apps/app/app/api/mcp/tools.ts",
  ]);
  const apiFiles = walkFiles("apps/app/app/api");
  const forbiddenApiFiles = apiFiles.filter((f) => !ALLOWED_API_FILES.has(f));
  if (forbiddenApiFiles.length > 0) {
    for (const f of forbiddenApiFiles) {
      fail(
        `${f} must not exist — route logic belongs in modules/{feature}-shell/routes/. ` +
          "See CLAUDE.md § API Route Architecture."
      );
    }
  } else {
    pass("app/api/ only contains the catch-all dispatcher (no rogue route files)");
  }

  for (const relDir of REQUIRED_DIRS) {
    if (!existsSync(resolve(ROOT, relDir))) {
      fail(`missing required structure directory: ${relDir}`);
    }
  }

  if (!failed) {
    pass("required structure directories exist");
  }

  for (const relDir of ZERO_ROOT_FILE_DIRS) {
    const rootFiles = getRootFiles(relDir);
    if (rootFiles.length > 0) {
      fail(`${relDir} contains loose root files: ${rootFiles.join(", ")}`);
    } else {
      pass(`${relDir} has no loose root files`);
    }
  }

  const budgetViolations = walkDirs(APP_ROOT).filter((relDir) => {
    const dirName = relDir.split("/").pop() ?? "";
    if (DIRECT_FILE_BUDGET_EXEMPT_DIRS.has(relDir)) return false;
    if (DIRECT_FILE_BUDGET_EXEMPT_NAMES.has(dirName)) return false;
    return getRootFiles(relDir).length > MAX_DIRECT_FILES;
  });

  if (budgetViolations.length > 0) {
    for (const relDir of budgetViolations) {
      fail(
        `${relDir} exceeds the direct-file budget (${getRootFiles(relDir).length}/${MAX_DIRECT_FILES})`
      );
    }
  } else {
    pass(`apps/app directories respect the ${MAX_DIRECT_FILES}-file direct budget`);
  }

  const hookFiles = walkFiles("apps/app/hooks").filter(isHookImplementation);
  const invalidHookFiles = hookFiles.filter((filePath) => {
    const baseName = filePath.split("/").pop() ?? "";
    return !baseName.startsWith("use-");
  });

  if (invalidHookFiles.length > 0) {
    fail(
      `hook implementation files must start with \`use-\`: ${invalidHookFiles.join(", ")}`
    );
  } else {
    pass("hook implementation files use `use-` naming");
  }

  const appFiles = walkFiles(APP_ROOT);
  const testsOutsideBuckets = appFiles.filter(
    (filePath) => isTestFile(filePath) && !filePath.includes("/__tests__/")
  );
  if (testsOutsideBuckets.length > 0) {
    fail(`tests must live in __tests__ folders: ${testsOutsideBuckets.join(", ")}`);
  } else {
    pass("tests live in __tests__ folders");
  }

  const storiesOutsideBuckets = appFiles.filter(
    (filePath) => isStoryFile(filePath) && !filePath.includes("/__stories__/")
  );
  if (storiesOutsideBuckets.length > 0) {
    fail(`stories must live in __stories__ folders: ${storiesOutsideBuckets.join(", ")}`);
  } else {
    pass("stories live in __stories__ folders");
  }

  const libRootFiles = getRootFiles("apps/app/lib");
  if (libRootFiles.length > 0) {
    fail(`apps/app/lib must not contain loose root files: ${libRootFiles.join(", ")}`);
  } else {
    pass("apps/app/lib has no loose root files");
  }

  if (failed) {
    process.exit(1);
  }
}

main();
