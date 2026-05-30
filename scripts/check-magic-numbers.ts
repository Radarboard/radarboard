import { execSync } from "node:child_process";

/**
 * Diff-aware check for magic numbers in staged files.
 * Flags timeouts > 1s, API limits, and duration calculations
 * that should be named constants.
 * Exit 0 (warning only) — does not block commits.
 */

const PATTERNS: Array<{ regex: RegExp; message: string }> = [
  {
    regex: /setTimeout\s*\(\s*\S+\s*,\s*(\d{4,})\s*\)/,
    message: "setTimeout with magic duration — extract to a named constant",
  },
  {
    regex: /setInterval\s*\(\s*\S+\s*,\s*(\d{4,})\s*\)/,
    message: "setInterval with magic duration — extract to a named constant",
  },
  {
    regex: /\d+\s*\*\s*60\s*\*\s*1000/,
    message: "Duration calculation — extract to a named constant (e.g., CACHE_TTL_MS)",
  },
  {
    regex: /\d+\s*\*\s*1000/,
    message: "Duration calculation — extract to a named constant",
  },
];

function getStagedFiles(): string[] {
  const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
    encoding: "utf8",
  }).trim();

  return output
    ? output
        .split("\n")
        .filter(Boolean)
        .filter((f) => /\.(ts|tsx)$/.test(f))
        .filter((f) => !f.includes(".test.") && !f.includes(".spec.") && !f.includes("scripts/"))
    : [];
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) return;

  const warnings: string[] = [];

  for (const filePath of stagedFiles) {
    let diff: string;
    try {
      diff = execSync(`git diff --cached -U0 -- "${filePath}"`, { encoding: "utf8" });
    } catch {
      continue;
    }

    for (const line of diff.split("\n")) {
      if (!line.startsWith("+") || line.startsWith("+++")) continue;
      const content = line.slice(1);

      for (const { regex, message } of PATTERNS) {
        if (regex.test(content)) {
          warnings.push(`  ${filePath}: ${message}`);
          break;
        }
      }
    }
  }

  if (warnings.length > 0) {
    console.warn("Magic numbers detected in new code:");
    for (const w of warnings) {
      console.warn(w);
    }
  }
}

main();
