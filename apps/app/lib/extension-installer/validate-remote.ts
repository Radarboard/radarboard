/**
 * Validate a GitHub repo as a Radarboard extension without cloning.
 * Uses the GitHub API to fetch package.json and check structure.
 */

import type { GitHubRepo } from "./parse-github-url";

export type ExtensionCategory = "integration" | "plugin" | "widget";

export interface ValidationResult {
  valid: boolean;
  category: ExtensionCategory | null;
  id: string | null;
  name: string | null;
  description: string | null;
  errors: string[];
  warnings: string[];
}

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

const CATEGORY_PREFIXES: Record<string, ExtensionCategory> = {
  "@radarboard/integration-": "integration",
  "@radarboard/plugin-": "plugin",
  "@radarboard/widget-": "widget",
};

/**
 * Fetch a file from a GitHub repo via raw.githubusercontent.com.
 */
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

/**
 * Validate a GitHub repo as a Radarboard extension.
 */
export async function validateRemoteExtension(repo: GitHubRepo): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Fetch package.json
  const pkgContent = await fetchGitHubFile(repo, "package.json");
  if (!pkgContent) {
    return {
      valid: false,
      category: null,
      id: null,
      name: null,
      description: null,
      errors: ["No package.json found in repository root. Is this a Radarboard extension?"],
      warnings: [],
    };
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgContent);
  } catch {
    return {
      valid: false,
      category: null,
      id: null,
      name: null,
      description: null,
      errors: ["package.json is not valid JSON."],
      warnings: [],
    };
  }

  // 2. Detect category from package name
  const pkgName = pkg.name as string | undefined;
  if (!pkgName) {
    errors.push("package.json missing 'name' field.");
    return {
      valid: false,
      category: null,
      id: null,
      name: null,
      description: null,
      errors,
      warnings,
    };
  }

  let category: ExtensionCategory | null = null;
  let id: string | null = null;

  for (const [prefix, cat] of Object.entries(CATEGORY_PREFIXES)) {
    if (pkgName.startsWith(prefix)) {
      category = cat;
      id = pkgName.replace(prefix, "");
      break;
    }
  }

  if (!category || !id) {
    errors.push(
      `Package name "${pkgName}" doesn't match @radarboard/{integration,plugin,widget}-* pattern.`
    );
    return {
      valid: false,
      category: null,
      id: null,
      name: pkgName,
      description: null,
      errors,
      warnings,
    };
  }

  // 3. Check exports map
  const exports = pkg.exports as Record<string, string> | undefined;
  if (!exports || typeof exports !== "object") {
    errors.push("package.json missing 'exports' map.");
  } else if (!exports["."]) {
    errors.push('package.json exports missing "." (default) entry.');
  }

  // 4. Check dependencies
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const allowedDeps = ALLOWED_WORKSPACE_DEPS[category];

  for (const dep of Object.keys(deps)) {
    if (!dep.startsWith("@radarboard/")) continue;
    if (allowedDeps.includes(dep)) continue;

    // Check if it's a cross-extension import (forbidden)
    const isCrossExtension = Object.keys(CATEGORY_PREFIXES).some(
      (prefix) => dep.startsWith(prefix) && dep !== pkgName
    );

    if (isCrossExtension) {
      errors.push(`Forbidden cross-extension dependency: ${dep}`);
    } else {
      warnings.push(`Dependency ${dep} is not in the standard allowlist for ${category}s.`);
    }
  }

  // 5. Check required SDK dependency
  const sdkMap: Record<ExtensionCategory, string> = {
    integration: "@radarboard/integration-sdk",
    plugin: "@radarboard/plugin-sdk",
    widget: "@radarboard/widget-sdk",
  };
  const requiredSdk = sdkMap[category];
  if (!deps[requiredSdk]) {
    errors.push(`Missing required dependency: ${requiredSdk}`);
  }

  // 6. Check for descriptor in entry file
  const entryPath = exports?.["."];
  if (entryPath) {
    const entryContent = await fetchGitHubFile(repo, entryPath);
    if (!entryContent) {
      warnings.push(`Entry file "${entryPath}" could not be fetched.`);
    } else if (!entryContent.includes("Descriptor")) {
      warnings.push("Entry file does not appear to export a descriptor.");
    }
  }

  // 7. Check for conformance test
  const hasConformanceTest =
    (await fetchGitHubFile(repo, "src/conformance.test.ts")) !== null ||
    (await fetchGitHubFile(repo, "src/__tests__/conformance.test.ts")) !== null;

  if (!hasConformanceTest) {
    warnings.push("No conformance test found. Add one for quality compliance.");
  }

  const description = (pkg.description as string) ?? null;

  return {
    valid: errors.length === 0,
    category,
    id,
    name: pkgName,
    description,
    errors,
    warnings,
  };
}
