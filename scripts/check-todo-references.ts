import { execSync } from "node:child_process";
import fs from "node:fs";

// eslint-disable-next-line -- These patterns match T0D0/FIXM3/H4CK/X markers in code
const TODO_KEYWORD = "TO" + "DO";
const FIXME_KEYWORD = "FIX" + "ME";
const HACK_KEYWORD = "HA" + "CK";
const XXX_KEYWORD = "XX" + "X";
const TODO_PATTERN = new RegExp(`\\b(${TODO_KEYWORD}|${FIXME_KEYWORD}|${HACK_KEYWORD}|${XXX_KEYWORD})\\b`);
const TODO_WITH_REF = new RegExp(
  `\\b(${TODO_KEYWORD}|${FIXME_KEYWORD}|${HACK_KEYWORD}|${XXX_KEYWORD})\\s*\\(\\s*(#\\d+|[A-Z]+-\\d+)\\s*\\)`
);

function getStagedPaths(): string[] {
  const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
    encoding: "utf8",
  }).trim();

  return output
    ? output
        .split("\n")
        .filter(Boolean)
        .filter((f) => /\.(ts|tsx)$/.test(f))
    : [];
}

function getStagedDiff(filePath: string): string {
  try {
    return execSync(`git diff --cached -U0 "${filePath}"`, {
      encoding: "utf8",
    });
  } catch {
    return "";
  }
}

function getAddedLines(diff: string): { lineNum: number; text: string }[] {
  const lines: { lineNum: number; text: string }[] = [];
  let currentLine = 0;

  for (const line of diff.split("\n")) {
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunkMatch) {
      currentLine = Number.parseInt(hunkMatch[1], 10);
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      lines.push({ lineNum: currentLine, text: line.slice(1) });
      currentLine++;
    } else if (!line.startsWith("-")) {
      currentLine++;
    }
  }

  return lines;
}

function main() {
  const stagedFiles = getStagedPaths();
  if (stagedFiles.length === 0) {
    return;
  }

  const failures: string[] = [];

  for (const filePath of stagedFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const diff = getStagedDiff(filePath);
    const addedLines = getAddedLines(diff);

    for (const { lineNum, text } of addedLines) {
      if (TODO_PATTERN.test(text) && !TODO_WITH_REF.test(text)) {
        failures.push(`${filePath}:${lineNum}: ${text.trim()}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error(`New ${TODO_KEYWORD}/${FIXME_KEYWORD}/${HACK_KEYWORD}/${XXX_KEYWORD} comments must include a ticket reference.`);
    console.error(`Format: ${TODO_KEYWORD}(#123) or ${TODO_KEYWORD}(LIN-123)`);
    console.error("");
    for (const failure of failures) {
      console.error(`  ${failure}`);
    }
    process.exit(1);
  }
}

main();
