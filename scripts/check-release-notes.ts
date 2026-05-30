import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const placeholderFragments = [
  "Replace with",
  "replace this comment",
  "@example",
  "Radarboard Release Notes Template",
  "Draft release notes",
  "TODO:",
];

function resolvePath(argv: string[]): string {
  const pathFlagIndex = argv.findIndex((arg) => arg === "--path");

  if (pathFlagIndex >= 0) {
    const flagValue = argv[pathFlagIndex + 1];

    if (!flagValue) {
      throw new Error("Expected a value after --path");
    }

    return path.resolve(rootDir, flagValue);
  }

  const tagFlagIndex = argv.findIndex((arg) => arg === "--tag");

  if (tagFlagIndex >= 0) {
    const tagValue = argv[tagFlagIndex + 1];

    if (!tagValue) {
      throw new Error("Expected a value after --tag");
    }

    return path.join(rootDir, "release-notes", `${tagValue}.md`);
  }

  throw new Error("Provide --path <release-notes/file.md> or --tag <tag>");
}

function main() {
  const releaseNotesPath = resolvePath(process.argv.slice(2));

  if (!existsSync(releaseNotesPath)) {
    throw new Error(`Missing curated release notes: ${path.relative(rootDir, releaseNotesPath)}`);
  }

  const contents = readFileSync(releaseNotesPath, "utf8");
  const normalizedContents = contents.toLowerCase();

  for (const fragment of placeholderFragments) {
    if (normalizedContents.includes(fragment.toLowerCase())) {
      throw new Error(
        `Release notes still contain template placeholder content (${JSON.stringify(fragment)}): ${path.relative(rootDir, releaseNotesPath)}`
      );
    }
  }

  console.log(`release notes look ready: ${path.relative(rootDir, releaseNotesPath)}`);
}

main();
