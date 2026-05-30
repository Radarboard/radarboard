import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const desktopNextPath = path.join(process.cwd(), "release-notes", "desktop-next.md");

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function listChangedFiles(): Set<string> {
  const result = spawnSync("git", ["diff", "--name-only"], {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return new Set(
    result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

function hasNewReleaseDiff(before: Set<string>, after: Set<string>): boolean {
  for (const filePath of after) {
    if (!before.has(filePath)) {
      return true;
    }
  }

  return false;
}

const beforeVersionFiles = listChangedFiles();
const wantsDesktopRelease = existsSync(desktopNextPath);
run("pnpm", ["exec", "changeset", "version"]);
const afterVersionFiles = listChangedFiles();

if (!hasNewReleaseDiff(beforeVersionFiles, afterVersionFiles)) {
  console.log("no pending version changes detected; skipping release note scaffolding");
  process.exit(0);
}

if (!wantsDesktopRelease) {
  console.log("desktop release signal not present; skipping desktop version bump and DMG release prep");
  process.exit(0);
}

run("pnpm", ["exec", "tsx", "scripts/bump-desktop-release-version.ts"]);
run("pnpm", ["release:notes:generate"]);
rmSync(desktopNextPath);
