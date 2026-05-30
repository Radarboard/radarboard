/**
 * Validate a GitHub repo as a Radarboard extension package (multi-extension).
 *
 * An extension package is a single repo that can contain any combination of:
 * - integrations/ — one or more integration packages
 * - plugins/ — one or more plugin packages
 * - widgets/ — one or more widget packages
 *
 * The repo root contains a `radarboard-extension.json` manifest declaring
 * which sub-packages to install. This enables patterns like:
 *   - "Notion" = integration + plugin + widget in one repo
 *   - "Analytics Suite" = 3 widgets + 1 integration
 *
 * If no manifest is found, falls back to single-extension validation.
 */

import type { GitHubRepo } from "./parse-github-url";
import type { ExtensionCategory, ValidationResult } from "./validate-remote";
import { validateRemoteExtension } from "./validate-remote";

// ---------------------------------------------------------------------------
// Extension Package manifest shape
// ---------------------------------------------------------------------------

/**
 * Manifest for multi-extension packages.
 * Lives at the repo root as `radarboard-extension.json`.
 */
export interface ExtensionPackageManifest {
  /** Human-readable name for the package. */
  name: string;
  /** Description of the overall package. */
  description?: string;
  /** Author information. */
  author?: { name: string; url?: string };
  /** Minimum Radarboard version required. */
  minAppVersion?: string;
  /** Extensions included in this package. */
  extensions: ExtensionPackageEntry[];
}

export interface ExtensionPackageEntry {
  /** Extension type. */
  type: ExtensionCategory;
  /** Relative path from repo root (e.g. "integrations/notion"). */
  path: string;
  /** Package name (e.g. "@radarboard/integration-notion"). */
  name: string;
  /** Whether this extension is required or optional. Default: true. */
  required?: boolean;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface PackageValidationResult {
  /** Whether this repo is a multi-extension package (has manifest). */
  isPackage: boolean;
  /** Overall validation status. */
  valid: boolean;
  /** Manifest data (if found). */
  manifest: ExtensionPackageManifest | null;
  /** Per-extension validation results. */
  extensions: Array<{
    entry: ExtensionPackageEntry;
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;
  /** Package-level errors. */
  errors: string[];
  /** Package-level warnings. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// GitHub file fetcher
// ---------------------------------------------------------------------------

async function fetchGitHubFile(
  repo: GitHubRepo,
  path: string,
  branch = "main"
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${branch}/${path}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ALLOWED_WORKSPACE_DEPS: Record<ExtensionCategory, string[]> = {
  integration: ["@radarboard/integration-sdk", "@radarboard/types", "@radarboard/utils"],
  plugin: [
    "@radarboard/plugin-sdk",
    "@radarboard/types",
    "@radarboard/utils",
    "@radarboard/ui",
    "@radarboard/hooks",
    "@radarboard/widget-engine",
    "@radarboard/embedding-service",
    "@radarboard/llm",
  ],
  widget: [
    "@radarboard/widget-sdk",
    "@radarboard/widget-engine",
    "@radarboard/types",
    "@radarboard/utils",
    "@radarboard/ui",
    "@radarboard/charts",
    "@radarboard/hooks",
    "@radarboard/assistant-ui",
  ],
};

const SDK_MAP: Record<ExtensionCategory, string> = {
  integration: "@radarboard/integration-sdk",
  plugin: "@radarboard/plugin-sdk",
  widget: "@radarboard/widget-sdk",
};

/**
 * Validate a single extension entry within a package.
 */
async function validateEntry(
  repo: GitHubRepo,
  entry: ExtensionPackageEntry
): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Fetch package.json for this sub-package
  const pkgContent = await fetchGitHubFile(repo, `${entry.path}/package.json`);
  if (!pkgContent) {
    errors.push(`No package.json found at ${entry.path}/`);
    return { valid: false, errors, warnings };
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgContent);
  } catch {
    errors.push(`Invalid JSON in ${entry.path}/package.json`);
    return { valid: false, errors, warnings };
  }

  // Check name matches
  if (pkg.name !== entry.name) {
    errors.push(
      `Package name mismatch: manifest says "${entry.name}" but package.json has "${pkg.name}"`
    );
  }

  // Check exports
  const exports = pkg.exports as Record<string, string> | undefined;
  if (!exports?.["."]) {
    errors.push(`${entry.path}/package.json missing "." export`);
  }

  // Check dependencies
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const allowed = ALLOWED_WORKSPACE_DEPS[entry.type];
  const requiredSdk = SDK_MAP[entry.type];

  if (!deps[requiredSdk]) {
    errors.push(`${entry.path} missing required dependency: ${requiredSdk}`);
  }

  for (const dep of Object.keys(deps)) {
    if (!dep.startsWith("@radarboard/")) continue;
    if (!allowed.includes(dep)) {
      warnings.push(
        `${entry.path}: dependency ${dep} not in standard allowlist for ${entry.type}s`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a GitHub repo as a multi-extension package.
 *
 * Checks for `radarboard-extension.json` manifest at repo root.
 * If not found, returns `isPackage: false` — caller should fall back to
 * single-extension validation.
 */
export async function validateExtensionPackage(repo: GitHubRepo): Promise<PackageValidationResult> {
  const manifestContent = await fetchGitHubFile(repo, "radarboard-extension.json");

  if (!manifestContent) {
    return {
      isPackage: false,
      valid: false,
      manifest: null,
      extensions: [],
      errors: [],
      warnings: [],
    };
  }

  let manifest: ExtensionPackageManifest;
  try {
    manifest = JSON.parse(manifestContent);
  } catch {
    return {
      isPackage: true,
      valid: false,
      manifest: null,
      extensions: [],
      errors: ["radarboard-extension.json is not valid JSON"],
      warnings: [],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!manifest.name) errors.push("Manifest missing 'name' field");
  if (!manifest.extensions?.length) errors.push("Manifest has no extensions declared");

  // Validate each extension entry
  const extensionResults = await Promise.all(
    (manifest.extensions ?? []).map(async (entry) => {
      const result = await validateEntry(repo, entry);
      return { entry, ...result };
    })
  );

  // Check for at least one valid required extension
  const requiredExtensions = extensionResults.filter((r) => r.entry.required !== false);
  if (requiredExtensions.length > 0 && requiredExtensions.every((r) => !r.valid)) {
    errors.push("All required extensions have validation errors");
  }

  return {
    isPackage: true,
    valid: errors.length === 0 && requiredExtensions.every((r) => r.valid),
    manifest,
    extensions: extensionResults,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Unified validation entry point
// ---------------------------------------------------------------------------

export type UnifiedValidationResult =
  | { kind: "package"; result: PackageValidationResult }
  | { kind: "single"; result: ValidationResult };

/**
 * Validate a GitHub repo — checks for multi-extension package first,
 * then falls back to single-extension validation.
 */
export async function validateGitHubExtension(repo: GitHubRepo): Promise<UnifiedValidationResult> {
  const packageResult = await validateExtensionPackage(repo);

  if (packageResult.isPackage) {
    return { kind: "package", result: packageResult };
  }

  // No manifest — try single-extension validation
  const singleResult = await validateRemoteExtension(repo);
  return { kind: "single", result: singleResult };
}
