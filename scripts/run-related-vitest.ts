import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

type PackageJson = {
  scripts?: Record<string, string>;
};

type WorkspaceRun = {
  stagedFiles: string[];
  workspaceDir: string;
};

const REPO_ROOT = process.cwd();
const WORKSPACE_ROOTS = new Set(["apps", "features", "integrations", "packages", "plugins", "widgets"]);
const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/u;
const SNAPSHOT_FILE_PATTERN = /\.snap$/u;
const CONFIG_FILE_PATTERN = /^vitest\.config\.[^.]+$/u;

function runGit(args: string[]) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
}

function getStagedFiles(): string[] {
  const output = runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function isWorkspaceCandidate(filePath: string) {
  const [root] = filePath.split("/");
  return WORKSPACE_ROOTS.has(root);
}

function isVitestRelevantFile(filePath: string) {
  const basename = path.posix.basename(filePath);

  if (basename === "package.json") {
    return true;
  }

  if (CONFIG_FILE_PATTERN.test(basename) || SNAPSHOT_FILE_PATTERN.test(basename)) {
    return true;
  }

  return SOURCE_FILE_PATTERN.test(basename);
}

function findWorkspaceDir(filePath: string): string | null {
  let currentDir = path.join(REPO_ROOT, path.dirname(filePath));

  while (currentDir.startsWith(REPO_ROOT)) {
    const packageJsonPath = path.join(currentDir, "package.json");
    if (existsSync(packageJsonPath)) {
      const relativeDir = path.relative(REPO_ROOT, currentDir).replaceAll(path.sep, "/");
      return relativeDir || null;
    }

    if (currentDir === REPO_ROOT) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}

function readPackageJson(workspaceDir: string): PackageJson {
  const packageJsonPath = path.join(REPO_ROOT, workspaceDir, "package.json");
  return JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
}

function isVitestWorkspace(workspaceDir: string) {
  const packageJson = readPackageJson(workspaceDir);
  return packageJson.scripts?.test?.includes("vitest") ?? false;
}

function shouldRunFullWorkspaceTest(files: string[]) {
  return files.some((filePath) => {
    const basename = path.posix.basename(filePath);
    return (
      basename === "package.json" ||
      CONFIG_FILE_PATTERN.test(basename) ||
      SNAPSHOT_FILE_PATTERN.test(basename)
    );
  });
}

function toWorkspaceRelativePath(workspaceDir: string, filePath: string) {
  const relativePath = path.posix.relative(workspaceDir, filePath);

  if (relativePath.startsWith("..")) {
    throw new Error(`File ${filePath} does not belong to workspace ${workspaceDir}`);
  }

  return relativePath;
}

function collectWorkspaceRuns(files: string[]): WorkspaceRun[] {
  const runs = new Map<string, Set<string>>();

  for (const filePath of files) {
    if (!isWorkspaceCandidate(filePath) || !isVitestRelevantFile(filePath)) {
      continue;
    }

    const workspaceDir = findWorkspaceDir(filePath);
    if (!workspaceDir || !isVitestWorkspace(workspaceDir)) {
      continue;
    }

    const stagedFiles = runs.get(workspaceDir) ?? new Set<string>();
    stagedFiles.add(filePath);
    runs.set(workspaceDir, stagedFiles);
  }

  return [...runs.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([workspaceDir, stagedFiles]) => ({
      workspaceDir,
      stagedFiles: [...stagedFiles].sort((left, right) => left.localeCompare(right)),
    }));
}

function runCommand(workspaceDir: string, args: string[]) {
  const childEnv = { ...process.env };
  delete childEnv.GITHUB_ACTIONS;
  delete childEnv.GITHUB_STEP_SUMMARY;

  const result = spawnSync("pnpm", args, {
    cwd: path.join(REPO_ROOT, workspaceDir),
    env: childEnv,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function writeGitHubSummary(workspaceRuns: WorkspaceRun[]) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const lines = [
    "## Vitest Package Summary",
    "",
    "Packages covered by this step:",
    ...workspaceRuns.map(({ workspaceDir, stagedFiles: workspaceFiles }) => {
      const mode = shouldRunFullWorkspaceTest(workspaceFiles) ? "full suite" : "related tests";
      return `- \`${workspaceDir}\` (${mode})`;
    }),
    "",
  ];

  appendFileSync(summaryPath, `${lines.join("\n")}\n`);
}

function main() {
  const explicitFiles = process.argv.slice(2).map((filePath) => filePath.replaceAll(path.sep, "/"));
  const stagedFiles = explicitFiles.length > 0 ? explicitFiles : getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log("No staged files detected. Skipping related Vitest checks.");
    return;
  }

  const workspaceRuns = collectWorkspaceRuns(stagedFiles);
  if (workspaceRuns.length === 0) {
    console.log("No staged Vitest workspaces detected. Skipping related Vitest checks.");
    return;
  }

  writeGitHubSummary(workspaceRuns);

  for (const { workspaceDir, stagedFiles: workspaceFiles } of workspaceRuns) {
    if (shouldRunFullWorkspaceTest(workspaceFiles)) {
      console.log(`Running full Vitest suite for ${workspaceDir}`);
      runCommand(workspaceDir, ["test", "--", "--reporter=default"]);
      continue;
    }

    const relatedFiles = workspaceFiles.map((filePath) => toWorkspaceRelativePath(workspaceDir, filePath));
    console.log(`Running related Vitest checks for ${workspaceDir}`);
    runCommand(workspaceDir, [
      "exec",
      "vitest",
      "related",
      "--run",
      "--passWithNoTests",
      "--reporter=default",
      ...relatedFiles,
    ]);
  }
}

main();
