/**
 * Install a validated extension from GitHub into the monorepo.
 *
 * Steps:
 * 1. Download and extract the repo into the correct directory
 * 2. Add to radarboard.config.ts
 * 3. Run pnpm generate:extensions
 * 4. Run pnpm install
 *
 * This requires a rebuild after installation.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { GitHubRepo } from "./parse-github-url";
import type { ExtensionCategory } from "./validate-remote";

export interface InstallProgress {
  step: string;
  status: "running" | "done" | "error";
  message?: string;
}

export interface InstallResult {
  success: boolean;
  directory: string;
  rebuildRequired: boolean;
  error?: string;
}

const ROOT = process.cwd();

const CATEGORY_DIRS: Record<ExtensionCategory, string> = {
  integration: "integrations",
  plugin: "plugins",
  widget: "widgets",
};

/**
 * Install an extension from GitHub.
 * Calls onProgress for each step to enable streaming UI updates.
 */
export async function installExtension(
  repo: GitHubRepo,
  category: ExtensionCategory,
  id: string,
  onProgress?: (progress: InstallProgress) => void
): Promise<InstallResult> {
  const categoryDir = CATEGORY_DIRS[category];
  const targetDir = join(ROOT, categoryDir, id);

  // Check if already exists
  if (existsSync(targetDir)) {
    return {
      success: false,
      directory: targetDir,
      rebuildRequired: false,
      error: `Extension "${id}" already exists at ${categoryDir}/${id}`,
    };
  }

  try {
    // Step 1: Download repo
    onProgress?.({
      step: "download",
      status: "running",
      message: `Cloning ${repo.owner}/${repo.repo}...`,
    });

    mkdirSync(targetDir, { recursive: true });

    execSync(
      `git clone --depth 1 https://github.com/${repo.owner}/${repo.repo}.git "${targetDir}"`,
      { cwd: ROOT, stdio: "pipe" }
    );

    // Remove .git directory — this is now part of our monorepo
    const gitDir = join(targetDir, ".git");
    if (existsSync(gitDir)) {
      rmSync(gitDir, { recursive: true, force: true });
    }

    onProgress?.({ step: "download", status: "done" });

    // Step 2: Add to config
    onProgress?.({
      step: "config",
      status: "running",
      message: "Updating radarboard.config.ts...",
    });

    // Dynamic import to avoid bundling the config editor in the Next.js client
    const { addToConfig } = await import("../../../../scripts/lib/config-editor");
    addToConfig(category, id);

    onProgress?.({ step: "config", status: "done" });

    // Step 3: Generate extensions
    onProgress?.({ step: "generate", status: "running", message: "Regenerating init files..." });

    execSync("pnpm generate:extensions", { cwd: ROOT, stdio: "pipe" });

    onProgress?.({ step: "generate", status: "done" });

    // Step 4: Install dependencies
    onProgress?.({ step: "install", status: "running", message: "Installing dependencies..." });

    execSync("pnpm install", { cwd: ROOT, stdio: "pipe" });

    onProgress?.({ step: "install", status: "done" });

    return {
      success: true,
      directory: targetDir,
      rebuildRequired: true,
    };
  } catch (err) {
    // Clean up on failure
    if (existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
    }

    const message = err instanceof Error ? err.message : String(err);

    onProgress?.({ step: "error", status: "error", message });

    return {
      success: false,
      directory: targetDir,
      rebuildRequired: false,
      error: message,
    };
  }
}

/**
 * Uninstall an extension by removing its directory and config entry.
 */
export async function uninstallExtension(
  category: ExtensionCategory,
  id: string,
  onProgress?: (progress: InstallProgress) => void
): Promise<InstallResult> {
  const categoryDir = CATEGORY_DIRS[category];
  const targetDir = join(ROOT, categoryDir, id);

  if (!existsSync(targetDir)) {
    return {
      success: false,
      directory: targetDir,
      rebuildRequired: false,
      error: `Extension "${id}" not found at ${categoryDir}/${id}`,
    };
  }

  try {
    // Step 1: Remove from config
    onProgress?.({
      step: "config",
      status: "running",
      message: "Removing from radarboard.config.ts...",
    });

    const { removeFromConfig } = await import("../../../../scripts/lib/config-editor");
    removeFromConfig(category, id);

    onProgress?.({ step: "config", status: "done" });

    // Step 2: Remove directory
    onProgress?.({
      step: "remove",
      status: "running",
      message: `Removing ${categoryDir}/${id}...`,
    });

    rmSync(targetDir, { recursive: true, force: true });

    onProgress?.({ step: "remove", status: "done" });

    // Step 3: Regenerate
    onProgress?.({ step: "generate", status: "running", message: "Regenerating init files..." });

    execSync("pnpm generate:extensions", { cwd: ROOT, stdio: "pipe" });

    onProgress?.({ step: "generate", status: "done" });

    // Step 4: Reinstall
    onProgress?.({ step: "install", status: "running", message: "Updating dependencies..." });

    execSync("pnpm install", { cwd: ROOT, stdio: "pipe" });

    onProgress?.({ step: "install", status: "done" });

    return {
      success: true,
      directory: targetDir,
      rebuildRequired: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress?.({ step: "error", status: "error", message });

    return {
      success: false,
      directory: targetDir,
      rebuildRequired: false,
      error: message,
    };
  }
}
