/**
 * Install a validated multi-extension package from GitHub.
 *
 * Unlike single-extension install, a package repo can contain multiple
 * extensions (integrations, plugins, widgets) declared in a manifest.
 * Each sub-extension is extracted to its correct monorepo directory.
 *
 * Steps:
 * 1. Clone the repo to a temp directory
 * 2. For each extension in the manifest, copy to the correct category dir
 * 3. Add each extension to radarboard.config.ts
 * 4. Run pnpm generate:extensions
 * 5. Run pnpm install
 */

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { InstallProgress } from "./install";
import type { GitHubRepo } from "./parse-github-url";
import type { ExtensionPackageEntry, ExtensionPackageManifest } from "./validate-package";
import type { ExtensionCategory } from "./validate-remote";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PackageInstallResult {
  success: boolean;
  /** Per-extension install results. */
  extensions: Array<{
    entry: ExtensionPackageEntry;
    directory: string;
    installed: boolean;
    error?: string;
  }>;
  rebuildRequired: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = process.cwd();

const CATEGORY_DIRS: Record<ExtensionCategory, string> = {
  integration: "integrations",
  plugin: "plugins",
  widget: "widgets",
};

/**
 * Derive a directory name from the package name.
 * e.g. "@radarboard/integration-notion" → "notion"
 *      "@radarboard/widget-notion-tasks" → "notion-tasks"
 */
function deriveExtensionId(entry: ExtensionPackageEntry): string {
  const prefixMap: Record<ExtensionCategory, string> = {
    integration: "@radarboard/integration-",
    plugin: "@radarboard/plugin-",
    widget: "@radarboard/widget-",
  };
  const prefix = prefixMap[entry.type];
  if (entry.name.startsWith(prefix)) {
    return entry.name.slice(prefix.length);
  }
  // Fallback: use last segment of path
  return basename(entry.path);
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/**
 * Install a multi-extension package from GitHub.
 *
 * @param repo - Parsed GitHub repo info
 * @param manifest - Validated package manifest
 * @param onProgress - Optional progress callback for streaming UI
 */
export async function installExtensionPackage(
  repo: GitHubRepo,
  manifest: ExtensionPackageManifest,
  onProgress?: (progress: InstallProgress) => void
): Promise<PackageInstallResult> {
  const tempDir = mkdtempSync(join(tmpdir(), "radarboard-pkg-"));
  const extensionResults: PackageInstallResult["extensions"] = [];
  const installedDirs: string[] = [];

  try {
    // Step 1: Clone the full repo to temp
    onProgress?.({
      step: "download",
      status: "running",
      message: `Cloning ${repo.owner}/${repo.repo}...`,
    });

    execSync(
      `git clone --depth 1 https://github.com/${repo.owner}/${repo.repo}.git "${tempDir}/repo"`,
      { cwd: ROOT, stdio: "pipe" }
    );

    // Capture the HEAD commit SHA for update tracking
    let commitSha: string | undefined;
    try {
      commitSha = execSync("git rev-parse HEAD", {
        cwd: join(tempDir, "repo"),
        encoding: "utf-8",
      }).trim();
    } catch {
      // Non-fatal — update checks will be skipped without a SHA
    }

    onProgress?.({ step: "download", status: "done" });

    // Step 2: Copy each extension to the correct directory
    onProgress?.({
      step: "extract",
      status: "running",
      message: `Installing ${manifest.extensions.length} extension(s)...`,
    });

    for (const entry of manifest.extensions) {
      const id = deriveExtensionId(entry);
      const categoryDir = CATEGORY_DIRS[entry.type];
      const targetDir = join(ROOT, categoryDir, id);
      const sourceDir = join(tempDir, "repo", entry.path);

      if (existsSync(targetDir)) {
        extensionResults.push({
          entry,
          directory: targetDir,
          installed: false,
          error: `Already exists at ${categoryDir}/${id}`,
        });
        continue;
      }

      if (!existsSync(sourceDir)) {
        extensionResults.push({
          entry,
          directory: targetDir,
          installed: false,
          error: `Source path "${entry.path}" not found in repo`,
        });
        continue;
      }

      mkdirSync(targetDir, { recursive: true });
      cpSync(sourceDir, targetDir, { recursive: true });

      // Remove nested .git if somehow present
      const nestedGit = join(targetDir, ".git");
      if (existsSync(nestedGit)) {
        rmSync(nestedGit, { recursive: true, force: true });
      }

      installedDirs.push(targetDir);
      extensionResults.push({
        entry,
        directory: targetDir,
        installed: true,
      });
    }

    onProgress?.({ step: "extract", status: "done" });

    // Check if any extensions were actually installed
    const installedCount = extensionResults.filter((r) => r.installed).length;
    if (installedCount === 0) {
      return {
        success: false,
        extensions: extensionResults,
        rebuildRequired: false,
        error: "No extensions could be installed (all already exist or paths missing)",
      };
    }

    // Step 3: Add each installed extension to config
    onProgress?.({
      step: "config",
      status: "running",
      message: "Updating radarboard.config.ts...",
    });

    const { addToConfig } = await import("../../../../scripts/lib/config-editor");

    for (const result of extensionResults) {
      if (!result.installed) continue;
      const id = deriveExtensionId(result.entry);
      addToConfig(result.entry.type, id);
    }

    onProgress?.({ step: "config", status: "done" });

    // Step 4: Generate extensions
    onProgress?.({
      step: "generate",
      status: "running",
      message: "Regenerating init files...",
    });

    execSync("pnpm generate:extensions", { cwd: ROOT, stdio: "pipe" });

    onProgress?.({ step: "generate", status: "done" });

    // Step 5: Install dependencies
    onProgress?.({
      step: "install",
      status: "running",
      message: "Installing dependencies...",
    });

    execSync("pnpm install", { cwd: ROOT, stdio: "pipe" });

    onProgress?.({ step: "install", status: "done" });

    // Step 6: Record the installation for update tracking
    try {
      const { upsertInstalledExtension } = await import(
        "@/data/extensions/sqlite-installed-extensions"
      );
      const now = Math.floor(Date.now() / 1000);
      const types = extensionResults.filter((r) => r.installed).map((r) => r.entry.type);

      await upsertInstalledExtension({
        id: `${repo.owner}/${repo.repo}`,
        githubUrl: `https://github.com/${repo.owner}/${repo.repo}`,
        commitSha: commitSha ?? null,
        extensionTypes: types,
        installedAt: now,
        updatedAt: now,
      });
    } catch {
      // Non-fatal — extension is installed, just not tracked for updates
    }

    return {
      success: true,
      extensions: extensionResults,
      rebuildRequired: true,
    };
  } catch (err) {
    // Roll back: remove any directories we created
    for (const dir of installedDirs) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    const message = err instanceof Error ? err.message : String(err);
    onProgress?.({ step: "error", status: "error", message });

    return {
      success: false,
      extensions: extensionResults,
      rebuildRequired: false,
      error: message,
    };
  } finally {
    // Always clean up temp directory
    rmSync(tempDir, { recursive: true, force: true });
  }
}
