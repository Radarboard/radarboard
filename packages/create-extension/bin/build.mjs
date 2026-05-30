#!/usr/bin/env node

/**
 * radarboard-extension build
 *
 * Validates and type-checks an extension package before submission.
 * Runs the same checks that CI would run on a PR.
 *
 * Usage:
 *   npx radarboard-extension build
 *   npx radarboard-extension build --strict
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const strict = process.argv.includes("--strict");

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result === false) throw new Error("Check returned false");
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

console.log("\nRadarboard Extension Build\n");

// 1. Package.json exists
check("package.json exists", () => {
  if (!existsSync(join(cwd, "package.json"))) throw new Error("Not found");
  return true;
});

// 2. Package name follows convention
check("Package name follows @radarboard/* convention", () => {
  const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
  if (!pkg.name?.startsWith("@radarboard/")) {
    throw new Error(`Expected @radarboard/* prefix, got "${pkg.name}"`);
  }
  return true;
});

// 3. Exports map exists
check("Exports map in package.json", () => {
  const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
  if (!pkg.exports || !pkg.exports["."]) {
    throw new Error('Missing exports["."]');
  }
  return true;
});

// 4. Entry file exists
check("Entry file exists", () => {
  const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
  const entry = pkg.exports?.["."];
  if (!entry || !existsSync(join(cwd, entry))) {
    throw new Error(`Entry "${entry}" not found on disk`);
  }
  return true;
});

// 5. SDK dependency present
check("SDK dependency declared", () => {
  const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  const hasSDK =
    deps["@radarboard/integration-sdk"] ||
    deps["@radarboard/plugin-sdk"] ||
    deps["@radarboard/widget-sdk"];
  if (!hasSDK) throw new Error("No @radarboard/*-sdk dependency found");
  return true;
});

// 6. Has test files
check("Test files exist", () => {
  const srcDir = join(cwd, "src");
  if (!existsSync(srcDir)) return true; // Widgets may not have src/

  function hasTests(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "node_modules") {
        if (hasTests(join(dir, entry.name))) return true;
      }
      if (entry.name.match(/\.(test|spec)\.(ts|tsx)$/)) return true;
    }
    return false;
  }

  if (!hasTests(cwd)) throw new Error("No .test.ts or .spec.ts files found");
  return true;
});

// 7. CHANGELOG.md exists
check("CHANGELOG.md exists", () => {
  if (!existsSync(join(cwd, "CHANGELOG.md"))) {
    throw new Error("Not found — create one from the template");
  }
  return true;
});

// 8. TypeScript check (if strict mode)
if (strict) {
  check("TypeScript compiles", () => {
    try {
      execSync("npx tsc --noEmit", { cwd, stdio: "pipe" });
    } catch (err) {
      throw new Error(err.stderr?.toString().split("\n")[0] ?? "TypeScript errors");
    }
    return true;
  });
}

// Summary
console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.error("Build validation failed. Fix the issues above before submitting.");
  process.exit(1);
} else {
  console.log("All checks passed! Your extension is ready for submission.");
}
