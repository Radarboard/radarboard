import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = process.cwd();
const desktopPackagePath = path.join(rootDir, "apps", "desktop", "package.json");
const tauriConfigPath = path.join(rootDir, "apps", "desktop", "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(rootDir, "apps", "desktop", "src-tauri", "Cargo.toml");
const releaseNotesDir = path.join(rootDir, "release-notes");

export type ReleaseChannel = "alpha" | "beta" | "stable";
type VersionedJson = {
  version?: string;
  [key: string]: unknown;
};

type ParsedDesktopVersion = {
  major: number;
  minor: number;
  patch: number;
  channel: ReleaseChannel;
  prereleaseNumber: number | null;
};

type DesktopVersions = {
  packageVersion: string;
  tauriVersion: string;
  cargoVersion: string;
};

const releaseNotePlaceholderFragments = [
  "replace with",
  "replace this comment",
  "@example",
  "radarboard release notes template",
  "draft release notes",
  "todo:",
];

export function parseArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

export function parseDesktopVersion(version: string): ParsedDesktopVersion {
  const match =
    /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<channel>alpha|beta)\.(?<prereleaseNumber>\d+))?$/.exec(
      version
    );

  if (!match?.groups) {
    throw new Error(`Unsupported desktop version format: ${version}`);
  }

  return {
    major: Number(match.groups.major),
    minor: Number(match.groups.minor),
    patch: Number(match.groups.patch),
    channel: (match.groups.channel as ReleaseChannel | undefined) ?? "stable",
    prereleaseNumber: match.groups.prereleaseNumber
      ? Number(match.groups.prereleaseNumber)
      : null,
  };
}

export function formatDesktopVersion(version: ParsedDesktopVersion): string {
  const base = `${version.major}.${version.minor}.${version.patch}`;

  if (version.channel === "stable") {
    return base;
  }

  return `${base}-${version.channel}.${version.prereleaseNumber ?? 1}`;
}

export function computeNextBetaVersion(currentVersion: string): string {
  const current = parseDesktopVersion(currentVersion);

  if (current.channel === "beta") {
    return formatDesktopVersion({
      ...current,
      prereleaseNumber: (current.prereleaseNumber ?? 0) + 1,
    });
  }

  return formatDesktopVersion({
    ...current,
    patch: current.patch + 1,
    channel: "beta",
    prereleaseNumber: 1,
  });
}

export function computeNextAlphaVersion(currentVersion: string): string {
  const current = parseDesktopVersion(currentVersion);

  if (current.channel === "alpha") {
    return formatDesktopVersion({
      ...current,
      prereleaseNumber: (current.prereleaseNumber ?? 0) + 1,
    });
  }

  return formatDesktopVersion({
    ...current,
    patch: current.patch + 1,
    channel: "alpha",
    prereleaseNumber: 1,
  });
}

export function computeStableVersion(currentVersion: string): string {
  const current = parseDesktopVersion(currentVersion);

  if (current.channel !== "beta") {
    throw new Error("Stable desktop release promotion requires the current version to be beta.");
  }

  return formatDesktopVersion({
    ...current,
    channel: "stable",
    prereleaseNumber: null,
  });
}

export function validateVersion({ channel, version }: { channel: ReleaseChannel; version: string }) {
  const patterns: Record<ReleaseChannel, RegExp> = {
    alpha: /^\d+\.\d+\.\d+-alpha\.\d+$/,
    beta: /^\d+\.\d+\.\d+-beta\.\d+$/,
    stable: /^\d+\.\d+\.\d+$/,
  };

  if (!patterns[channel].test(version)) {
    throw new Error(
      `Version ${version} does not match ${channel} channel format: ${patterns[channel].source}`
    );
  }
}

function readJson(filePath: string): VersionedJson {
  return JSON.parse(readFileSync(filePath, "utf8")) as VersionedJson;
}

function writeJson(filePath: string, value: VersionedJson) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  // JSON.stringify expands short arrays across multiple lines, which biome
  // reformats inline — leaving the file failing the pre-push biome check.
  // Normalize with biome so the release commit is clean out of the box.
  formatWithBiome(filePath);
}

function formatWithBiome(filePath: string) {
  try {
    execFileSync("pnpm", ["exec", "biome", "format", "--write", filePath], {
      cwd: rootDir,
      stdio: "ignore",
    });
  } catch {
    // Best effort: if biome is unavailable the file is still valid JSON, and the
    // pre-push biome check would surface any remaining formatting drift.
  }
}

function replaceCargoVersion(contents: string, nextVersion: string): string {
  const updated = contents.replace(/^version = "([^"]+)"$/m, `version = "${nextVersion}"`);

  if (updated === contents) {
    throw new Error(`Failed to update Cargo version in ${cargoTomlPath}`);
  }

  return updated;
}

function readDesktopVersions(): DesktopVersions {
  const desktopPackage = readJson(desktopPackagePath);
  const tauriConfig = readJson(tauriConfigPath);
  const cargoToml = readFileSync(cargoTomlPath, "utf8");
  const cargoVersionMatch = /^version = "([^"]+)"$/m.exec(cargoToml);

  if (!desktopPackage.version || !tauriConfig.version || !cargoVersionMatch?.[1]) {
    throw new Error("Desktop package.json, tauri.conf.json, and Cargo.toml must declare versions.");
  }

  return {
    packageVersion: desktopPackage.version,
    tauriVersion: tauriConfig.version,
    cargoVersion: cargoVersionMatch[1],
  };
}

function assertAlignedVersions(versions: DesktopVersions) {
  const uniqueVersions = new Set([
    versions.packageVersion,
    versions.tauriVersion,
    versions.cargoVersion,
  ]);

  if (uniqueVersions.size !== 1) {
    throw new Error(
      `Desktop versions are not aligned: package.json=${versions.packageVersion}, tauri.conf.json=${versions.tauriVersion}, Cargo.toml=${versions.cargoVersion}`
    );
  }
}

function writeReleaseNotesDraft({ channel, tag }: { channel: ReleaseChannel; tag: string }) {
  mkdirSync(releaseNotesDir, { recursive: true });
  const releaseNotesPath = path.join(releaseNotesDir, `${tag}.md`);

  if (existsSync(releaseNotesPath)) {
    return releaseNotesPath;
  }

  writeFileSync(
    releaseNotesPath,
    `# Radarboard Desktop ${tag}\n\nDraft release notes for the ${channel} channel.\n\n## Highlights\n\n- TODO: describe what changed for testers or users.\n\n## Install notes\n\n- TODO: describe the install or update path for this channel.\n`
  );

  return releaseNotesPath;
}

function assertReleaseNotesReady(tag: string) {
  const releaseNotesPath = path.join(releaseNotesDir, `${tag}.md`);

  if (!existsSync(releaseNotesPath)) {
    throw new Error(`Missing release notes: ${path.relative(rootDir, releaseNotesPath)}`);
  }

  const contents = readFileSync(releaseNotesPath, "utf8").toLowerCase();

  for (const fragment of releaseNotePlaceholderFragments) {
    if (contents.includes(fragment)) {
      throw new Error(
        `Release notes still contain placeholder content (${JSON.stringify(fragment)}): ${path.relative(rootDir, releaseNotesPath)}`
      );
    }
  }
}

function assertTagDoesNotExist(tag: string) {
  const existingTag = execFileSync("git", ["tag", "--list", tag], {
    cwd: rootDir,
    encoding: "utf8",
  }).trim();

  if (existingTag) {
    throw new Error(`Desktop release tag already exists locally: ${tag}`);
  }
}

function writeDesktopVersion(version: string) {
  const desktopPackage = readJson(desktopPackagePath);
  const tauriConfig = readJson(tauriConfigPath);

  desktopPackage.version = version;
  tauriConfig.version = version;

  writeJson(desktopPackagePath, desktopPackage);
  writeJson(tauriConfigPath, tauriConfig);
  writeFileSync(cargoTomlPath, replaceCargoVersion(readFileSync(cargoTomlPath, "utf8"), version));
}

function inferAction(): ReleaseChannel | "dry-run" {
  const positionalAction = process.argv[2];

  if (
    positionalAction === "alpha" ||
    positionalAction === "beta" ||
    positionalAction === "stable" ||
    positionalAction === "dry-run"
  ) {
    return positionalAction;
  }

  const legacyChannel = parseArg("--channel");
  if (legacyChannel === "alpha" || legacyChannel === "beta" || legacyChannel === "stable") {
    return legacyChannel;
  }

  throw new Error("Expected alpha, beta, stable, or dry-run.");
}

function main() {
  const action = inferAction();
  const currentVersions = readDesktopVersions();
  assertAlignedVersions(currentVersions);
  const currentVersion = currentVersions.packageVersion;

  const versionOverride = parseArg("--version");
  const version =
    versionOverride ??
    (action === "alpha"
      ? computeNextAlphaVersion(currentVersion)
      : action === "beta"
      ? computeNextBetaVersion(currentVersion)
      : action === "stable"
        ? computeStableVersion(currentVersion)
        : currentVersion);
  const channel = parseDesktopVersion(version).channel;
  validateVersion({ channel, version });

  const tag = `desktop-v${version}`;

  if (action === "dry-run" || process.argv.includes("--dry-run")) {
    assertReleaseNotesReady(tag);
    assertTagDoesNotExist(tag);
    console.log(`desktop release candidate is ready: ${tag}`);
    console.log("validated version alignment, release notes, and local tag availability");
    return;
  }

  writeDesktopVersion(version);
  const releaseNotesPath = writeReleaseNotesDraft({ channel, tag });

  console.log(`prepared ${channel} desktop release ${tag}`);
  console.log("updated apps/desktop/package.json, apps/desktop/src-tauri/tauri.conf.json, Cargo.toml");
  console.log(`release notes: ${path.relative(rootDir, releaseNotesPath)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
