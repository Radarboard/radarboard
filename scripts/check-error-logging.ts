import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Enforcement script: Ensures every `catch` block in API routes 
 * includes a `log.error()` call for centralized error reporting.
 */

const ROUTE_FILE_PATTERNS = [
  // Module-level route handlers (new architecture)
  /^apps\/app\/modules\/[^/]+-shell\/routes\/(?!__tests__\/).+\.ts$/,
  // Catch-all dispatcher itself
  /^apps\/app\/app\/api\/\[\.\.\.path\]\/route\.ts$/,
];

function isRouteFile(f: string): boolean {
  return ROUTE_FILE_PATTERNS.some((re) => re.test(f));
}

function getStagedFiles(): string[] {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
      encoding: "utf8",
    }).trim();

    return output
      ? output
          .split("\n")
          .filter(Boolean)
          .filter((f) => isRouteFile(f))
          .filter((f) => !f.includes(".test.") && !f.includes(".spec."))
      : [];
  } catch {
    return [];
  }
}

function checkFile(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const errors: string[] = [];

  // Very basic check: if 'catch' is present, 'log.error' must be present
  // This isn't 100% accurate (could have multiple catch blocks), but it's a good start
  // and catches the most common case of swallowing errors.
  
  if (content.includes("catch") && !content.includes("log.error")) {
    errors.push(`  ${filePath}: Found 'catch' block but no 'log.error()' call. All errors must be reported.`);
  }

  // Also check if they are using 'catch (_error)' which often indicates intent to ignore
  if (content.includes("catch (_error)")) {
     errors.push(`  ${filePath}: Use 'catch (error)' and log it instead of 'catch (_error)'.`);
  }

  return errors;
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) return;

  const allErrors: string[] = [];

  for (const filePath of stagedFiles) {
    const fileErrors = checkFile(filePath);
    allErrors.push(...fileErrors);
  }

  if (allErrors.length > 0) {
    console.error("\x1b[31mERROR: Swallowed errors detected in API routes!\x1b[0m");
    console.error("All 'catch' blocks in API routes must call 'log.error(message, { error })' to ensure they are sent to debug events and Sentry.\n");
    for (const err of allErrors) {
      console.error(err);
    }
    process.exit(1);
  }
}

main();
