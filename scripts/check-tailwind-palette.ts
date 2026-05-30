import { execSync } from "node:child_process";

/**
 * Diff-aware check for raw Tailwind palette colors in staged files.
 * Only flags genuinely NEW palette usage in added lines.
 */

const PALETTE_COLORS = [
  "red", "green", "blue", "yellow", "orange", "purple", "pink",
  "gray", "slate", "zinc", "neutral", "stone", "amber", "lime",
  "emerald", "teal", "cyan", "sky", "indigo", "violet", "fuchsia", "rose",
].join("|");

const UTILITIES = ["text", "bg", "border", "ring", "fill", "stroke", "outline"].join("|");

const PALETTE_REGEX = new RegExp(
  `(?:${UTILITIES})-(?:${PALETTE_COLORS})-\\d+`
);

const STANDALONE_REGEX = /(?:text|bg|border)-(white|black)(?![a-z-])/;

const TOKEN_SUGGESTIONS: Record<string, string> = {
  "text-red": "text-destructive",
  "text-green": "text-success",
  "text-emerald": "text-success",
  "text-yellow": "text-warning",
  "text-amber": "text-warning",
  "text-blue": "text-accent",
  "text-sky": "text-accent",
  "text-indigo": "text-accent",
  "text-gray": "text-muted-foreground or text-dim",
  "text-slate": "text-muted-foreground or text-dim",
  "text-zinc": "text-muted-foreground or text-dim",
  "text-neutral": "text-muted-foreground or text-dim",
  "text-white": "text-foreground or text-primary-foreground",
  "text-black": "text-background",
  "bg-red": "bg-destructive or bg-destructive-bg",
  "bg-green": "bg-success-bg",
  "bg-emerald": "bg-success-bg",
  "bg-blue": "bg-info-bg or bg-accent",
  "bg-gray": "bg-muted or bg-secondary",
  "bg-slate": "bg-muted or bg-secondary",
  "bg-white": "bg-surface or bg-card",
  "bg-black": "bg-background",
  "border-gray": "border-border or border-line",
  "border-slate": "border-border or border-line",
};

function getStagedFiles(): string[] {
  const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
    encoding: "utf8",
  }).trim();

  return output
    ? output
        .split("\n")
        .filter(Boolean)
        .filter((f) => /\.(ts|tsx)$/.test(f))
        .filter((f) => !f.startsWith("scripts/"))
    : [];
}

function getSuggestedToken(match: string): string {
  for (const [pattern, suggestion] of Object.entries(TOKEN_SUGGESTIONS)) {
    if (match.startsWith(pattern)) {
      return suggestion;
    }
  }
  return "a semantic design token";
}

function extractPaletteValues(line: string): string[] {
  const results: string[] = [];
  const paletteMatches = line.match(new RegExp(PALETTE_REGEX.source, "g"));
  if (paletteMatches) results.push(...paletteMatches);
  const standaloneMatches = line.match(new RegExp(STANDALONE_REGEX.source, "g"));
  if (standaloneMatches) results.push(...standaloneMatches);
  return results;
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    return;
  }

  const violations: Array<{ file: string; value: string; suggestion: string }> = [];

  for (const filePath of stagedFiles) {
    let diff: string;
    try {
      diff = execSync(`git diff --cached -U0 -- "${filePath}"`, { encoding: "utf8" });
    } catch {
      continue;
    }

    const removedValues = new Set<string>();
    const addedLines: string[] = [];

    for (const line of diff.split("\n")) {
      if (line.startsWith("-") && !line.startsWith("---")) {
        for (const value of extractPaletteValues(line)) {
          removedValues.add(value);
        }
      } else if (line.startsWith("+") && !line.startsWith("+++")) {
        if (PALETTE_REGEX.test(line) || STANDALONE_REGEX.test(line)) {
          addedLines.push(line.slice(1));
        }
      }
    }

    for (const addedLine of addedLines) {
      const values = extractPaletteValues(addedLine);
      const newValues = values.filter((v) => !removedValues.has(v));
      for (const value of newValues) {
        violations.push({
          file: filePath,
          value,
          suggestion: getSuggestedToken(value),
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error("New raw Tailwind palette colors detected. Use design system tokens instead:");
    console.error("");
    for (const { file, value, suggestion } of violations) {
      console.error(`  ${file}: ${value} -> Use \`${suggestion}\``);
    }
    process.exit(1);
  }
}

main();
