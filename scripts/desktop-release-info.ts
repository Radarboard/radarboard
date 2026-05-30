import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = process.cwd();
const desktopPackagePath = path.join("apps", "desktop", "package.json");

export type DesktopReleaseInfo = {
  tag: string;
  version: string;
  previous: string | null;
  changed: boolean;
  head: string;
};

export function readVersionFromJson(contents: string): string {
  const parsed = JSON.parse(contents) as { version?: string };

  if (!parsed.version) {
    throw new Error("Missing desktop package version");
  }

  return parsed.version;
}

export function buildDesktopReleaseInfo({
  currentVersion,
  previousVersion,
  head,
  forceCurrent = false,
}: {
  currentVersion: string;
  previousVersion: string | null;
  head: string;
  forceCurrent?: boolean;
}): DesktopReleaseInfo {
  return {
    tag: `desktop-v${currentVersion}`,
    version: currentVersion,
    previous: previousVersion,
    changed: forceCurrent || previousVersion !== currentVersion,
    head,
  };
}

function readVersionAtRevision(revision: string): string | null {
  try {
    const contents = execFileSync("git", ["show", `${revision}:${desktopPackagePath}`], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["inherit", "pipe", "inherit"],
    });

    return readVersionFromJson(contents);
  } catch {
    return null;
  }
}

function parseArg(name: string): string | null {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function main() {
  const base = parseArg("--base");
  const head = parseArg("--head") ?? "HEAD";
  const forceCurrent = process.argv.includes("--force-current");

  if (!base && !forceCurrent) {
    throw new Error("Expected --base <git-ref> or --force-current");
  }

  const currentContents = readFileSync(path.join(rootDir, desktopPackagePath), "utf8");
  const currentVersion = readVersionFromJson(currentContents);
  const previousVersion = base ? readVersionAtRevision(base) : null;
  const info = buildDesktopReleaseInfo({
    currentVersion,
    previousVersion,
    head,
    forceCurrent,
  });

  console.log(`tag=${info.tag}`);
  console.log(`version=${info.version}`);
  console.log(`previous=${info.previous ?? ""}`);
  console.log(`changed=${info.changed ? "true" : "false"}`);
  console.log(`head=${info.head}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
