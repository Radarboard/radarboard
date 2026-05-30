import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const templatePath = path.join(rootDir, "release-notes", "_template.md");
const desktopPackagePath = path.join(rootDir, "apps", "desktop", "package.json");

function readDesktopVersion(): string {
  const packageJson = JSON.parse(readFileSync(desktopPackagePath, "utf8")) as { version?: string };

  if (!packageJson.version) {
    throw new Error(`Missing version in ${desktopPackagePath}`);
  }

  return packageJson.version;
}

function resolveTagName(argv: string[]): string {
  const tagFlagIndex = argv.findIndex((arg) => arg === "--tag");

  if (tagFlagIndex >= 0) {
    const tagValue = argv[tagFlagIndex + 1];

    if (!tagValue) {
      throw new Error("Expected a value after --tag");
    }

    return tagValue;
  }

  return `desktop-v${readDesktopVersion()}`;
}

function main() {
  const tagName = resolveTagName(process.argv.slice(2));
  const releaseNotesDir = path.join(rootDir, "release-notes");
  const targetPath = path.join(releaseNotesDir, `${tagName}.md`);

  if (!existsSync(templatePath)) {
    throw new Error(`Missing release note template at ${templatePath}`);
  }

  mkdirSync(releaseNotesDir, { recursive: true });

  if (existsSync(targetPath)) {
    console.log(`release notes already exist: ${path.relative(rootDir, targetPath)}`);
    return;
  }

  copyFileSync(templatePath, targetPath);
  console.log(`created release notes: ${path.relative(rootDir, targetPath)}`);
}

main();
