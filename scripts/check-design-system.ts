import { execSync } from "node:child_process";

/**
 * Checks staged diffs for genuinely NEW inline Tailwind arbitrary values.
 *
 * Lines that already existed but were reformatted (e.g. by useSortedClasses)
 * appear as both a `-` and `+` in the diff. We only flag lines where an
 * inline pattern appears in a `+` line without a corresponding `-` line
 * containing the same pattern.
 */

const INLINE_PATTERN = /(?:text|bg|border|rounded|shadow|color)-\[(?!var\(--)/;

function getStagedFiles(): string[] {
  const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
    encoding: "utf8",
  }).trim();

  return output
    ? output
        .split("\n")
        .filter(Boolean)
        .filter((f) => /\.(ts|tsx|astro|css)$/.test(f))
    : [];
}

function extractInlineValues(line: string): string[] {
  const matches = line.match(/(?:text|bg|border|rounded|shadow|color)-\[[^\]]+\]/g);
  return matches ?? [];
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    return;
  }

  const violations: string[] = [];

  for (const filePath of stagedFiles) {
    let diff: string;
    try {
      diff = execSync(`git diff --cached -U0 -- "${filePath}"`, { encoding: "utf8" });
    } catch {
      continue;
    }

    const removedInlineValues = new Set<string>();
    const addedLines: string[] = [];

    for (const line of diff.split("\n")) {
      if (line.startsWith("-") && !line.startsWith("---")) {
        for (const value of extractInlineValues(line)) {
          removedInlineValues.add(value);
        }
      } else if (line.startsWith("+") && !line.startsWith("+++")) {
        if (INLINE_PATTERN.test(line)) {
          addedLines.push(line.slice(1));
        }
      }
    }

    for (const addedLine of addedLines) {
      const inlineValues = extractInlineValues(addedLine);
      const newValues = inlineValues.filter((v) => !removedInlineValues.has(v));
      if (newValues.length > 0) {
        violations.push(`${filePath}: ${newValues.join(", ")}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error("New inline Tailwind arbitrary values detected:");
    console.error("Use design tokens instead of hardcoded values.");
    console.error("");
    for (const v of violations) {
      console.error(`  ${v}`);
    }
    process.exit(1);
  }
}

main();
