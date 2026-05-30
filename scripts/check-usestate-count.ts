import { execSync } from "node:child_process";
import fs from "node:fs";

/**
 * Warns when a staged .tsx file contains more than 8 useState hooks.
 * Suggests using useReducer or extracting state into a custom hook.
 * Exit 0 (warning only) — does not block commits.
 */

const MAX_USE_STATE = 8;

function getStagedFiles(): string[] {
  const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
    encoding: "utf8",
  }).trim();

  return output
    ? output
        .split("\n")
        .filter(Boolean)
        .filter((f) => /\.tsx$/.test(f))
    : [];
}

function countUseState(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf8");
  const matches = content.match(/\buseState\s*[<(]/g);
  return matches ? matches.length : 0;
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) return;

  for (const filePath of stagedFiles) {
    const count = countUseState(filePath);
    if (count > MAX_USE_STATE) {
      console.warn(
        `WARNING: ${filePath} has ${count} useState hooks (max recommended: ${MAX_USE_STATE}).`
      );
      console.warn("  Consider using useReducer or extracting state into a custom hook.");
    }
  }
}

main();
