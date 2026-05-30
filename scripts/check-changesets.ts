import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Args = {
  since: string;
  staged: boolean;
};

type WorkspaceChange = {
  workspacePath: string;
  files: string[];
};

type ChangesetReleaseType = "major" | "minor" | "patch";

type ChangesetRelease = {
  packageName: string;
  releaseType: ChangesetReleaseType;
};

type ParsedChangeset = {
  filePath: string;
  releases: ChangesetRelease[];
};

const ENFORCED_ROOTS = new Set(["packages", "widgets", "plugins", "integrations", "features"]);
const DEFAULT_BASE_REF = "origin/main";
const CHANGESET_DIR = ".changeset";
const CHANGESET_CONFIG_PATH = path.join(process.cwd(), CHANGESET_DIR, "config.json");
const VALID_CHANGESET_RELEASE_TYPES = new Set<ChangesetReleaseType>(["major", "minor", "patch"]);

function parseArgs(argv: string[]): Args {
  const args: Args = {
    since: DEFAULT_BASE_REF,
    staged: false,
  };

  for (const arg of argv) {
    if (arg === "--staged") {
      args.staged = true;
      continue;
    }

    if (arg.startsWith("--since=")) {
      args.since = arg.slice("--since=".length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function runGit(args: string[]): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
}

function gitRefExists(ref: string): boolean {
  try {
    runGit(["rev-parse", "--verify", ref]);
    return true;
  } catch {
    return false;
  }
}

function resolveBaseRef(requestedRef: string): string {
  const candidates = [requestedRef];

  if (requestedRef.startsWith("origin/")) {
    candidates.push(requestedRef.slice("origin/".length));
  }

  for (const candidate of candidates) {
    if (candidate && gitRefExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to resolve base ref "${requestedRef}". Fetch the base branch or pass --since=<ref>.`
  );
}

function getChangedFiles(args: Args): string[] {
  if (args.staged) {
    const output = runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMRD"]);
    return output ? output.split("\n").filter(Boolean) : [];
  }

  const baseRef = resolveBaseRef(args.since);
  const output = runGit(["diff", "--name-only", "--diff-filter=ACMRD", `${baseRef}...HEAD`]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function getNonDeletedChangedFiles(args: Args): string[] {
  if (args.staged) {
    const output = runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
    return output ? output.split("\n").filter(Boolean) : [];
  }

  const baseRef = resolveBaseRef(args.since);
  const output = runGit(["diff", "--name-only", "--diff-filter=ACMR", `${baseRef}...HEAD`]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function isChangesetMarkdown(filePath: string): boolean {
  if (!filePath.startsWith(`${CHANGESET_DIR}/`)) {
    return false;
  }

  const basename = path.posix.basename(filePath);
  return basename.endsWith(".md") && basename !== "README.md";
}

function getWorkspacePath(filePath: string): string | null {
  const normalizedPath = filePath.replaceAll(path.sep, "/");
  const parts = normalizedPath.split("/");

  if (parts.length < 2) {
    return null;
  }

  const [root, workspaceName] = parts;
  if (!ENFORCED_ROOTS.has(root) || !workspaceName || workspaceName === "_template") {
    return null;
  }

  return `${root}/${workspaceName}`;
}

function getRelativeWorkspacePath(filePath: string): string | null {
  const workspacePath = getWorkspacePath(filePath);
  if (!workspacePath) {
    return null;
  }

  return filePath.slice(workspacePath.length + 1);
}

function isExemptRelativePath(relativePath: string): boolean {
  if (!relativePath) {
    return true;
  }

  if (/^README(?:\.[^/]+)?$/u.test(relativePath)) {
    return true;
  }

  if (relativePath.endsWith(".md") || relativePath.endsWith(".mdx")) {
    return true;
  }

  if (/(^|\/)__tests__\//u.test(relativePath) || /(^|\/)__snapshots__\//u.test(relativePath)) {
    return true;
  }

  if (/\.(test|spec)\.[^/]+$/u.test(relativePath)) {
    return true;
  }

  if (/\.stories\.[^/]+$/u.test(relativePath) || /\.scaffold\.stories\.[^/]+$/u.test(relativePath)) {
    return true;
  }

  return false;
}

function isReleaseArtifactRelativePath(relativePath: string): boolean {
  return relativePath === "package.json" || relativePath === "CHANGELOG.md";
}

function collectWorkspaceChanges(changedFiles: string[]): WorkspaceChange[] {
  const changes = new Map<string, string[]>();

  for (const filePath of changedFiles) {
    const workspacePath = getWorkspacePath(filePath);
    const relativePath = getRelativeWorkspacePath(filePath);

    if (!workspacePath || !relativePath || isExemptRelativePath(relativePath)) {
      continue;
    }

    const files = changes.get(workspacePath) ?? [];
    files.push(relativePath);
    changes.set(workspacePath, files);
  }

  return [...changes.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([workspacePath, files]) => ({
      workspacePath,
      files: files.sort((left, right) => left.localeCompare(right)),
    }));
}

function isReleaseArtifactOnlyChange(changes: WorkspaceChange[], changedFiles: string[]): boolean {
  if (changes.length === 0) {
    return false;
  }

  if (!changedFiles.some(isChangesetMarkdown)) {
    return false;
  }

  return changes.every(({ files }) => files.every(isReleaseArtifactRelativePath));
}

function formatWorkspaceChanges(changes: WorkspaceChange[]): string {
  return changes
    .map(({ workspacePath, files }) => `${workspacePath}: ${files.join(", ")}`)
    .join("\n");
}

function getIgnoredPackages(): Set<string> {
  const configContents = readFileSync(CHANGESET_CONFIG_PATH, "utf8");
  const config = JSON.parse(configContents) as { ignore?: unknown };

  if (config.ignore === undefined) {
    return new Set();
  }

  if (!Array.isArray(config.ignore) || config.ignore.some((entry) => typeof entry !== "string")) {
    throw new Error(`${CHANGESET_CONFIG_PATH}: Expected "ignore" to be an array of package names.`);
  }

  return new Set(config.ignore);
}

function parseChangesetReleaseLine(filePath: string, line: string): ChangesetRelease {
  const match = /^\s*(?:"([^"]+)"|([^":][^:]*)):\s*([a-z]+)\s*$/u.exec(line);
  if (!match) {
    throw new Error(`${filePath}: Invalid frontmatter entry "${line}".`);
  }

  const packageName = (match[1] ?? match[2] ?? "").trim();
  const releaseType = match[3];

  if (!packageName) {
    throw new Error(`${filePath}: Changeset entries must include a package name.`);
  }

  if (!VALID_CHANGESET_RELEASE_TYPES.has(releaseType as ChangesetReleaseType)) {
    throw new Error(`${filePath}: Unsupported release type "${releaseType}".`);
  }

  return {
    packageName,
    releaseType: releaseType as ChangesetReleaseType,
  };
}

export function parseChangesetFile(filePath: string, content: string): ParsedChangeset {
  const lines = content.split(/\r?\n/u);
  if (lines[0]?.trim() !== "---") {
    throw new Error(`${filePath}: Changesets must start with frontmatter delimited by "---".`);
  }

  const closingDelimiterIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingDelimiterIndex === -1) {
    throw new Error(`${filePath}: Missing closing changeset frontmatter delimiter.`);
  }

  const frontmatterLines = lines.slice(1, closingDelimiterIndex).filter((line) => line.trim().length > 0);
  if (frontmatterLines.length === 0) {
    throw new Error(`${filePath}: Changeset frontmatter must include at least one package.`);
  }

  const releases = frontmatterLines.map((line) => parseChangesetReleaseLine(filePath, line));
  const summary = lines.slice(closingDelimiterIndex + 1).join("\n").trim();

  if (!summary) {
    throw new Error(`${filePath}: Changeset summary must not be empty.`);
  }

  return {
    filePath,
    releases,
  };
}

export function validateParsedChangesets(
  parsedChangesets: ParsedChangeset[],
  ignoredPackages: ReadonlySet<string>
): void {
  for (const parsedChangeset of parsedChangesets) {
    const ignoredReleases = parsedChangeset.releases.filter(({ packageName }) => ignoredPackages.has(packageName));
    const versionedReleases = parsedChangeset.releases.filter(
      ({ packageName }) => !ignoredPackages.has(packageName)
    );

    if (ignoredReleases.length > 0 && versionedReleases.length > 0) {
      const fileName = path.posix.basename(parsedChangeset.filePath, ".md");

      throw new Error(
        [
          `Found mixed changeset ${fileName}`,
          `Found ignored packages: ${ignoredReleases.map(({ packageName }) => packageName).join(" ")}`,
          `Found not ignored packages: ${versionedReleases.map(({ packageName }) => packageName).join(" ")}`,
          "Mixed changesets that contain both ignored and not ignored packages are not allowed.",
        ].join("\n")
      );
    }
  }
}

function validateChangedChangesetFiles(filePaths: string[]): void {
  if (filePaths.length === 0) {
    return;
  }

  const ignoredPackages = getIgnoredPackages();
  const parsedChangesets = filePaths
    .sort((left, right) => left.localeCompare(right))
    .map((filePath) => parseChangesetFile(filePath, readFileSync(filePath, "utf8")));

  validateParsedChangesets(parsedChangesets, ignoredPackages);
}

export function main(argv: string[] = process.argv.slice(2)): void {
  const args = parseArgs(argv);
  const changedFiles = getChangedFiles(args);
  const nonDeletedChangedFiles = getNonDeletedChangedFiles(args);

  if (changedFiles.length === 0) {
    console.log("No changed files detected. Changeset check passed.");
    return;
  }

  validateChangedChangesetFiles(nonDeletedChangedFiles.filter(isChangesetMarkdown));

  const workspaceChanges = collectWorkspaceChanges(changedFiles);
  if (workspaceChanges.length === 0) {
    console.log("No qualifying enforced workspace changes detected. Changeset check passed.");
    return;
  }

  if (nonDeletedChangedFiles.some(isChangesetMarkdown)) {
    console.log("Changeset file detected for qualifying workspace changes. Changeset check passed.");
    return;
  }

  if (isReleaseArtifactOnlyChange(workspaceChanges, changedFiles)) {
    console.log("Release artifact-only changes detected. Changeset check passed.");
    return;
  }

  const scope = args.staged ? "staged changes" : `changes since ${resolveBaseRef(args.since)}`;
  const details = formatWorkspaceChanges(workspaceChanges);

  console.error(`Changeset required for qualifying workspace changes. Run: pnpm changeset

Checked scope: ${scope}

Qualifying workspace changes:
${details}`);

  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Changeset check failed: ${message}`);
    process.exit(1);
  }
}
