import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Enforcement script: Ensures integrations, plugins, and widgets remain
 * fully independent and modular.
 *
 * Two checks:
 * 1. Package.json dependency validation — workspace deps must be in the allowlist
 * 2. Source import scanning — catches cross-extension and forbidden prefix imports
 *
 * Biome's noRestrictedImports handles exact-match violations (wrong SDK, forbidden
 * shared packages). This script catches what Biome cannot: prefix-based cross-extension
 * imports (e.g., widget A importing widget B) and package.json dependency violations.
 */

type ExtensionCategory = "integration" | "plugin" | "widget" | "feature";

const ALLOWED_WORKSPACE_DEPS: Record<ExtensionCategory, string[]> = {
  integration: [
    "@radarboard/integration-sdk",
    "@radarboard/types",
    "@radarboard/utils",
  ],
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
  feature: [
    "@radarboard/feature-sdk",
    "@radarboard/types",
    "@radarboard/utils",
    "@radarboard/ui",
    "@radarboard/hooks",
    "@radarboard/integration-sdk",
    "@radarboard/plugin-sdk",
    "@radarboard/widget-engine",
    "@radarboard/assistant-core",
    "@radarboard/llm",
    "@radarboard/llm-adapter-vercel",
  ],
};

/** Prefixes that are always forbidden for a given category */
const FORBIDDEN_IMPORT_PREFIXES: Record<ExtensionCategory, string[]> = {
  integration: [
    "@radarboard/plugin-",
    "@radarboard/widget-",
    "@radarboard/feature-",
  ],
  plugin: [
    "@radarboard/integration-",
    "@radarboard/widget-",
    "@radarboard/feature-",
  ],
  widget: [
    "@radarboard/integration-",
    "@radarboard/plugin-",
    "@radarboard/feature-",
  ],
  feature: [
    "@radarboard/integration-",
  ],
};

/** Virtual integrations that may depend on other integrations */
const VIRTUAL_INTEGRATIONS = new Set(["shipping", "astro"]);

/** Packages in devDependencies that are always allowed */
const ALWAYS_ALLOWED_DEV_DEPS = new Set([
  "@radarboard/tsconfig",
]);

function getStagedFiles(): string[] {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
      encoding: "utf8",
    }).trim();

    return output ? output.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

function classifyFile(filePath: string): { category: ExtensionCategory; packageDir: string } | null {
  const integrationMatch = filePath.match(/^integrations\/([^/]+)\//);
  if (integrationMatch) {
    return { category: "integration", packageDir: integrationMatch[1] };
  }

  const pluginMatch = filePath.match(/^plugins\/([^/]+)\//);
  if (pluginMatch) {
    return { category: "plugin", packageDir: pluginMatch[1] };
  }

  const widgetMatch = filePath.match(/^widgets\/([^/]+)\//);
  if (widgetMatch) {
    return { category: "widget", packageDir: widgetMatch[1] };
  }

  const featureMatch = filePath.match(/^features\/([^/]+)\//);
  if (featureMatch) {
    return { category: "feature", packageDir: featureMatch[1] };
  }

  return null;
}

function getOwnPackageName(category: ExtensionCategory, packageDir: string): string {
  const prefixMap: Record<ExtensionCategory, string> = {
    integration: "@radarboard/integration-",
    plugin: "@radarboard/plugin-",
    widget: "@radarboard/widget-",
    feature: "@radarboard/feature-",
  };
  return `${prefixMap[category]}${packageDir}`;
}

function checkPackageJsonDeps(filePath: string, category: ExtensionCategory, packageDir: string): string[] {
  const errors: string[] = [];

  try {
    const content = JSON.parse(readFileSync(filePath, "utf8"));
    const deps = content.dependencies ?? {};

    const isVirtualIntegration = category === "integration" && VIRTUAL_INTEGRATIONS.has(packageDir);

    for (const dep of Object.keys(deps)) {
      if (!dep.startsWith("@radarboard/")) continue;

      // Check if this workspace dep is allowed
      if (ALLOWED_WORKSPACE_DEPS[category].includes(dep)) continue;

      // Virtual integrations may depend on other integrations
      if (isVirtualIntegration && dep.startsWith("@radarboard/integration-")) continue;

      // Check against forbidden prefixes
      for (const prefix of FORBIDDEN_IMPORT_PREFIXES[category]) {
        if (dep.startsWith(prefix)) {
          errors.push(
            `  ${filePath}: Forbidden dependency "${dep}" — ${category}s must not depend on ${prefix}* packages.`
          );
          break;
        }
      }

      // Also catch any @radarboard/* dep not in the allowlist
      if (
        !errors.some((e) => e.includes(dep)) &&
        !ALLOWED_WORKSPACE_DEPS[category].includes(dep)
      ) {
        const allowed = ALLOWED_WORKSPACE_DEPS[category].join(", ");
        errors.push(
          `  ${filePath}: Workspace dependency "${dep}" is not in the allowed list for ${category}s. Allowed: ${allowed}`
        );
      }
    }
  } catch {
    // Skip files we can't parse
  }

  return errors;
}

function checkSourceImports(filePath: string, category: ExtensionCategory, packageDir: string): string[] {
  const errors: string[] = [];

  try {
    const content = readFileSync(filePath, "utf8");

    // Match both static imports and dynamic imports
    const importRegex = /(?:from|import)\s+["'](@radarboard\/[^"']+)["']/g;
    let match: RegExpExecArray | null;

    const ownPackageName = getOwnPackageName(category, packageDir);
    const isVirtualIntegration = category === "integration" && VIRTUAL_INTEGRATIONS.has(packageDir);

    while ((match = importRegex.exec(content)) !== null) {
      const importSource = match[1];

      // Self-imports are fine (e.g., widget importing from itself)
      if (importSource === ownPackageName || importSource.startsWith(`${ownPackageName}/`)) {
        continue;
      }

      // Skip imports that match an allowed dependency (exact or subpath)
      const isAllowed = ALLOWED_WORKSPACE_DEPS[category].some(
        (allowed) => importSource === allowed || importSource.startsWith(`${allowed}/`)
      );
      if (isAllowed) continue;

      // Check forbidden prefixes
      for (const prefix of FORBIDDEN_IMPORT_PREFIXES[category]) {
        if (importSource.startsWith(prefix)) {
          // Virtual integrations may import other integrations
          if (isVirtualIntegration && prefix === "@radarboard/integration-") continue;

          // Check for cross-extension imports within the same category
          const sameCategory =
            (category === "widget" && importSource.startsWith("@radarboard/widget-")) ||
            (category === "plugin" && importSource.startsWith("@radarboard/plugin-")) ||
            (category === "integration" && importSource.startsWith("@radarboard/integration-"));

          const message = sameCategory
            ? `Cross-${category} import "${importSource}" — ${category}s must not depend on other ${category}s.`
            : `Forbidden import "${importSource}" — ${category}s must not import ${prefix}* packages.`;

          errors.push(`  ${filePath}: ${message}`);
          break;
        }
      }
    }
  } catch {
    // Skip files we can't read
  }

  return errors;
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) return;

  const allErrors: string[] = [];

  for (const filePath of stagedFiles) {
    // Skip templates
    if (filePath.includes("/_template/")) continue;

    const classification = classifyFile(filePath);
    if (!classification) continue;

    const { category, packageDir } = classification;

    if (filePath.endsWith("package.json")) {
      allErrors.push(...checkPackageJsonDeps(filePath, category, packageDir));
    }

    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
      allErrors.push(...checkSourceImports(filePath, category, packageDir));
    }
  }

  if (allErrors.length > 0) {
    console.error("\x1b[31mERROR: Module boundary violations detected!\x1b[0m");
    console.error(
      "Integrations, plugins, and widgets must remain independent.\n" +
        "See the allowed dependencies in scripts/check-module-boundaries.ts.\n"
    );
    for (const err of allErrors) {
      console.error(err);
    }
    process.exit(1);
  }
}

main();
