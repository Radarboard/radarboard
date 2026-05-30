import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PackageJson = Record<string, unknown> & {
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
};
type DependencyMap = Record<string, string>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const ROOT_PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");
const PNPM_WORKSPACE_PATH = path.join(REPO_ROOT, "pnpm-workspace.yaml");
const DEFAULT_DOCTOR_VERSION = "latest";
const EXCLUDED_DIR_NAMES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".generated",
  "_template",
  "__stories__",
  "__tests__",
  "coverage",
  "dist",
  "mocks",
  "node_modules",
  "scripts",
]);
const EXCLUDED_FILE_NAMES = new Set(["build-storybook.log"]);
const EXCLUDED_FILE_PATTERNS = [/\.(stories|test|spec)\.[jt]sx?$/u, /\.log$/u];
const WARNING_MARKER_PATTERN = /(^|\n)\s*[│]?\s*⚠\s+/u;
const FULL_SCAN_FALLBACK_PATTERN =
  /No feature branch or uncommitted changes detected\.\s+Running full scan\./u;

function parseScalar(raw: string): string {
  return raw.trim().replace(/^['"]|['"]$/g, "");
}

function parseWorkspaceCatalogs(workspacePath: string): {
  catalog: Record<string, string>;
  catalogs: Record<string, Record<string, string>>;
} {
  const content = readFileSync(workspacePath, "utf8");
  const catalog: Record<string, string> = {};
  const catalogs: Record<string, Record<string, string>> = {};

  let section: "none" | "catalog" | "catalogs" = "none";
  let activeNamedCatalog: string | null = null;

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    if (!line.startsWith(" ")) {
      activeNamedCatalog = null;
      if (trimmed === "catalog:") {
        section = "catalog";
        continue;
      }
      if (trimmed === "catalogs:") {
        section = "catalogs";
        continue;
      }
      section = "none";
      continue;
    }

    if (section === "catalog") {
      const match = line.match(/^ {2}([^:]+):\s*(.+)$/u);
      if (match) {
        catalog[parseScalar(match[1])] = parseScalar(match[2]);
      }
      continue;
    }

    if (section === "catalogs") {
      const namedCatalogMatch = line.match(/^ {2}([^:]+):\s*$/u);
      if (namedCatalogMatch) {
        activeNamedCatalog = parseScalar(namedCatalogMatch[1]);
        catalogs[activeNamedCatalog] = {};
        continue;
      }

      const dependencyMatch = line.match(/^ {4}([^:]+):\s*(.+)$/u);
      if (dependencyMatch && activeNamedCatalog) {
        catalogs[activeNamedCatalog][parseScalar(dependencyMatch[1])] = parseScalar(dependencyMatch[2]);
      }
    }
  }

  return { catalog, catalogs };
}

function synthesizeRootPackageJson(): PackageJson {
  const rootPackageJson = JSON.parse(readFileSync(ROOT_PACKAGE_JSON_PATH, "utf8")) as PackageJson;
  const { catalog, catalogs } = parseWorkspaceCatalogs(PNPM_WORKSPACE_PATH);

  if (Object.keys(catalog).length > 0) {
    rootPackageJson.catalog = {
      ...(rootPackageJson.catalog ?? {}),
      ...catalog,
    };
  }

  if (Object.keys(catalogs).length > 0) {
    rootPackageJson.catalogs = {
      ...(rootPackageJson.catalogs ?? {}),
      ...catalogs,
    };
  }

  return rootPackageJson;
}

function stripMotionDependency(packageJson: PackageJson): PackageJson {
  const dependencyKeys = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ] as const;

  for (const key of dependencyKeys) {
    const section = packageJson[key];
    if (!section || typeof section !== "object") continue;
    const dependencies = { ...(section as DependencyMap) };
    delete dependencies.motion;
    packageJson[key] = dependencies;
  }

  return packageJson;
}

function writeSanitizedPackageJson(sourcePath: string, targetPath: string): void {
  const packageJson = JSON.parse(readFileSync(sourcePath, "utf8")) as PackageJson;
  writeFileSync(targetPath, `${JSON.stringify(stripMotionDependency(packageJson), null, 2)}\n`);
}

function createMirrorRoot(): string {
  const mirrorRoot = mkdtempSync(path.join(tmpdir(), "radarboard-react-doctor-"));

  mirrorDirectory(REPO_ROOT, mirrorRoot, true);

  writeFileSync(
    path.join(mirrorRoot, "package.json"),
    `${JSON.stringify(synthesizeRootPackageJson(), null, 2)}\n`
  );

  return mirrorRoot;
}

function shouldExcludeEntry(sourcePath: string, isDirectory: boolean): boolean {
  const name = path.basename(sourcePath);

  if (isDirectory) {
    return EXCLUDED_DIR_NAMES.has(name);
  }

  return EXCLUDED_FILE_NAMES.has(name) || EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

function mirrorDirectory(sourceDir: string, targetDir: string, isRoot = false): void {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir)) {
    if (isRoot && entry === "package.json") continue;

    const sourcePath = path.join(sourceDir, entry);
    const targetPath = path.join(targetDir, entry);
    const stats = lstatSync(sourcePath);

    if (shouldExcludeEntry(sourcePath, stats.isDirectory())) {
      continue;
    }

    if (stats.isDirectory()) {
      mirrorDirectory(sourcePath, targetPath);
      continue;
    }

    if (entry === "package.json") {
      writeSanitizedPackageJson(sourcePath, targetPath);
      continue;
    }

    symlinkSync(sourcePath, targetPath);
  }
}

function resolveTargetDirectory(mirrorRoot: string, rawArgs: string[]): { args: string[] } {
  const [firstArg, ...rest] = rawArgs;

  if (!firstArg || firstArg.startsWith("-")) {
    return {
      args: rawArgs,
    };
  }

  const resolved = path.resolve(process.cwd(), firstArg);
  const relativeToRepo = path.relative(REPO_ROOT, resolved);
  if (relativeToRepo.startsWith("..") || path.isAbsolute(relativeToRepo)) {
    throw new Error(`react-doctor target must stay inside ${REPO_ROOT}`);
  }

  const mirrorTarget = path.join(mirrorRoot, relativeToRepo);
  return {
    args: [mirrorTarget, ...rest],
  };
}

function hasFailOnErrorArg(args: string[]): boolean {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--fail-on" && args[index + 1] === "error") {
      return true;
    }
    if (arg === "--fail-on=error") {
      return true;
    }
  }
  return false;
}

function extractWrapperArgs(rawArgs: string[]): { args: string[]; strictWarnings: boolean } {
  const args: string[] = [];
  let strictWarnings =
    process.env.REACT_DOCTOR_STRICT_WARNINGS === "1" ||
    process.env.REACT_DOCTOR_STRICT_WARNINGS === "true";

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--strict-warnings") {
      strictWarnings = true;
      continue;
    }

    if (arg === "--fail-on") {
      const next = rawArgs[index + 1];
      if (next === "warning" || next === "warnings") {
        strictWarnings = true;
        index += 1;
        continue;
      }
      args.push(arg);
      if (next !== undefined) {
        args.push(next);
        index += 1;
      }
      continue;
    }

    if (arg === "--fail-on=warning" || arg === "--fail-on=warnings") {
      strictWarnings = true;
      continue;
    }

    args.push(arg);
  }

  if (strictWarnings && !hasFailOnErrorArg(args)) {
    args.push("--fail-on", "error");
  }

  return { args, strictWarnings };
}

function runReactDoctor(mirrorRoot: string, args: string[], strictWarnings: boolean) {
  const version = process.env.REACT_DOCTOR_VERSION ?? DEFAULT_DOCTOR_VERSION;
  const result = spawnSync("pnpm", ["dlx", `react-doctor@${version}`, ...args], {
    cwd: mirrorRoot,
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  const combinedOutput = `${stdout}\n${stderr}`;

  // react-doctor may report warnings when its internal oxlint config references
  // rules that the installed oxlint version doesn't support. If the only
  // failures are oxlint parse errors (no actual code issues), treat as success.
  const hasOxlintConfigError = /Failed to parse oxlint (?:output|configuration)/.test(combinedOutput);
  const hasNoIssues = /No issues detected/.test(combinedOutput);
  if (hasOxlintConfigError && hasNoIssues) {
    process.stderr.write(
      "\nreact-doctor: ignoring oxlint config errors (no actual code issues found)\n"
    );
    process.exit(0);
  }

  const fellBackToFullScan = FULL_SCAN_FALLBACK_PATTERN.test(combinedOutput);
  if (strictWarnings && !fellBackToFullScan && WARNING_MARKER_PATTERN.test(combinedOutput)) {
    process.stderr.write(
      "\nreact-doctor strict mode: warnings are treated as errors; fix all warnings before committing.\n"
    );
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function main() {
  const mirrorRoot = createMirrorRoot();

  try {
    const rawArgs = process.argv.slice(2);
    const { args: wrapperArgs, strictWarnings } = extractWrapperArgs(rawArgs);
    const { args } = resolveTargetDirectory(mirrorRoot, wrapperArgs);
    runReactDoctor(mirrorRoot, args, strictWarnings);
  } finally {
    rmSync(mirrorRoot, { recursive: true, force: true });
  }
}

main();
