#!/usr/bin/env tsx
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const APP_ROOT = resolve(ROOT, "apps/app");
const WORKSPACE_ROOTS = ["features", "integrations", "packages", "plugins", "widgets"] as const;

const FORBIDDEN_APP_PATHS = [
  "apps/app/data/github-stars",
  "apps/app/components/notifications",
  "apps/app/components/database-provider-card",
  "apps/app/components/debug-dashboard",
  "apps/app/components/knowledge-health-dashboard",
  "apps/app/app/api/plugins/changelog",
  "apps/app/app/api/plugins/rss-reader",
  "apps/app/components/plugins/plugin-dock",
  "apps/app/components/plugins/plugin-launcher",
  "apps/app/components/plugins/plugin-overlay",
  "apps/app/components/plugins/rss-reader-background-poller",
  "apps/app/components/plugins/status-page-background-poller",
  "apps/app/components/webhook-relay-poller",
  "apps/app/components/widgets/github-repo-multi-picker",
  "apps/app/components/widgets/github-repo-multi-picker-utils",
  "apps/app/components/widgets/stars-repositories-section",
  "apps/app/app/api/integrations/analytics",
  "apps/app/app/api/integrations/github",
];

const ALLOWED_COMPONENT_ROOT_DIRS = new Set([
  "chrome",
  "credentials",
  "dashboard",
  "debug",
  "onboarding",
  "projects",
  "settings",
  "shared",
  "shortcuts",
  "system",
  "theme",
  "widgets",
]);

const ALLOWED_MODULE_ROOT_DIRS = new Set([
  "assistant-shell",
  "auth-shell",
  "backup-shell",
  "credentials-shell",
  "database-shell",
  "debug-shell",
  "demo-shell",
  "extensions-shell",
  "integration-shell",
  "mcp-shell",
  "notifications-shell",
  "plugin-shell",
  "provider-shell",
  "settings",
  "settings-shell",
]);

const ALLOWED_API_ROOT_DIRS = new Set([
  "[...path]",
  "assistant",
  "auth",
  "database",
  "dev",
  "extensions",
  "integrations",
  "mcp",
  "notifications",
  "plugins",
  "system",
]);

const APP_ZONE_PREFIXES = [
  "components/",
  "data/",
  "lib/",
  "scripts/",
] as const;

const APP_API_ROUTE_BRIDGES: Record<string, string> = {
  "app/api/assistant/briefing/route.ts":
    "Assistant-shell bridge for briefing feature delivery.",
  "app/api/assistant/chat/route.ts":
    "Assistant-shell bridge for chat feature orchestration.",
  "app/api/assistant/embeddings/route.ts":
    "Assistant-shell bridge for embeddings plugin behavior.",
  "app/api/assistant/workflows/route.ts":
    "Assistant-shell bridge for workflows feature orchestration.",
  "app/api/integrations/lemonsqueezy/webhook/route.ts":
    "Integration-shell bridge for Lemon Squeezy webhooks.",
  "app/api/integrations/[integration]/webhook/route.ts":
    "Integration-shell bridge for generic inbound webhooks.",
  "app/api/integrations/[integration]/[action]/route.ts":
    "Generic integration-shell bridge for integration actions.",
  "app/api/notifications/send/route.ts":
    "Notification-shell bridge for alert delivery.",
  "app/api/plugins/[plugin]/[action]/route.ts":
    "Generic app-shell bridge for plugin actions.",
  "app/api/plugins/webhook-relay/poll/route.ts":
    "Plugin-shell bridge for webhook relay polling.",
  "app/api/plugins/status-page/project-health/route.ts":
    "Plugin-shell bridge for status-page project health checks.",
};

const APP_API_ROUTE_OWNERSHIP_PATTERNS = [
  {
    pattern: /^app\/api\/plugins\/(?!data\/|token\/)[^/]+\/.+\/route\.(ts|tsx|js|jsx)$/,
    reason: "plugin-specific routes should go through the generic plugin bridge or an explicitly classified shell bridge",
  },
  {
    pattern: /^app\/api\/integrations\/[^/]+\/webhook\/route\.(ts|tsx|js|jsx)$/,
    reason: "integration webhook bridges should stay tightly constrained to explicitly classified shell bridges",
  },
];

const SDK_PACKAGES = new Set([
  "@radarboard/integration-sdk",
  "@radarboard/plugin-sdk",
  "@radarboard/widget-sdk",
  "@radarboard/widget-engine",
  "@radarboard/feature-sdk",
]);

const CANONICAL_API_ROUTE_FILE = "packages/types/src/api-routes.ts";
const RAW_API_ROUTE_LITERAL_PATTERN = /["'`]\/api\/(?:integrations|plugins)\//;

let failed = false;

function fail(message: string) {
  console.error(`✗ ${message}`);
  failed = true;
}

function pass(message: string) {
  console.log(`✓ ${message}`);
}

function walkTsFiles(rootDir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".turbo") {
        continue;
      }
      files.push(...walkTsFiles(absPath));
      continue;
    }
    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(absPath);
    }
  }
  return files;
}

function readImports(absFile: string): string[] {
  const content = readFileSync(absFile, "utf8");
  const matches = content.matchAll(/(?:from|import)\s+["']([^"']+)["']/g);
  return [...matches].map((match) => match[1]).filter(Boolean) as string[];
}

function isAppZone(relPath: string): boolean {
  return APP_ZONE_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function isExtensionImport(importSource: string): boolean {
  const base = importSource.split("/").slice(0, 2).join("/");
  if (SDK_PACKAGES.has(importSource) || SDK_PACKAGES.has(base)) return false;
  return (
    importSource.startsWith("@radarboard/integration-") ||
    importSource.startsWith("@radarboard/plugin-") ||
    importSource.startsWith("@radarboard/feature-")
  );
}

function isTemplateOrTestFile(relPath: string): boolean {
  return (
    relPath.includes("/_template/") ||
    relPath.includes("/__tests__/") ||
    relPath.includes("/__stories__/") ||
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(relPath)
  );
}

function main() {
  const existingForbiddenPaths = FORBIDDEN_APP_PATHS.filter((relPath) =>
    existsSync(resolve(ROOT, relPath))
  );

  if (existingForbiddenPaths.length > 0) {
    for (const relPath of existingForbiddenPaths) {
      fail(`forbidden app-owned path still exists: ${relPath}`);
    }
  } else {
    pass("forbidden app-owned paths removed");
  }

  const componentsRoot = resolve(ROOT, "apps/app/components");
  const unexpectedComponentRoots = existsSync(componentsRoot)
    ? readdirSync(componentsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => !ALLOWED_COMPONENT_ROOT_DIRS.has(name))
        .sort()
    : [];

  if (unexpectedComponentRoots.length > 0) {
    for (const name of unexpectedComponentRoots) {
      fail(`unexpected components root directory: apps/app/components/${name}`);
    }
  } else {
    pass("apps/app/components root namespaces are restricted to the approved shells");
  }

  const modulesRoot = resolve(ROOT, "apps/app/modules");
  const unexpectedModuleRoots = existsSync(modulesRoot)
    ? readdirSync(modulesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => !ALLOWED_MODULE_ROOT_DIRS.has(name))
        .sort()
    : [];

  if (unexpectedModuleRoots.length > 0) {
    for (const name of unexpectedModuleRoots) {
      fail(`unexpected modules root directory: apps/app/modules/${name}`);
    }
  } else {
    pass("apps/app/modules root namespaces are restricted to the approved shells");
  }

  const apiRoot = resolve(ROOT, "apps/app/app/api");
  const unexpectedApiRoots = existsSync(apiRoot)
    ? readdirSync(apiRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => !ALLOWED_API_ROOT_DIRS.has(name))
        .sort()
    : [];

  if (unexpectedApiRoots.length > 0) {
    for (const name of unexpectedApiRoots) {
      fail(`unexpected api root namespace: apps/app/app/api/${name}`);
    }
  } else {
    pass("apps/app/app/api root namespaces are restricted to the approved shells");
  }

  const appFiles = walkTsFiles(APP_ROOT);
  const appImportViolations: string[] = [];

  for (const absFile of appFiles) {
    const relPath = relative(APP_ROOT, absFile);
    if (!isAppZone(relPath)) continue;

    for (const source of readImports(absFile)) {
      if (/^@radarboard\/[^/]+\/src\//.test(source)) {
        appImportViolations.push(`${relPath} -> ${source}`);
      }
    }
  }

  if (appImportViolations.length > 0) {
    for (const violation of appImportViolations) {
      fail(`apps/app imports package internals instead of public exports: ${violation}`);
    }
  } else {
    pass("apps/app uses public workspace exports");
  }

  const apiFiles = appFiles.filter((absFile) => relative(APP_ROOT, absFile).startsWith("app/api/"));
  const apiRouteViolations: string[] = [];
  for (const absFile of apiFiles) {
    const relPath = relative(APP_ROOT, absFile);
    for (const { pattern, reason } of APP_API_ROUTE_OWNERSHIP_PATTERNS) {
      if (!pattern.test(relPath)) continue;

      const exceptionReason = APP_API_ROUTE_BRIDGES[relPath];
      if (exceptionReason) {
        continue;
      } else {
        apiRouteViolations.push(`${relPath} — ${reason}`);
      }
    }

    for (const source of readImports(absFile)) {
      if (!isExtensionImport(source)) continue;
      const exceptionReason = APP_API_ROUTE_BRIDGES[relPath];
      if (exceptionReason) {
        continue;
      } else {
        apiRouteViolations.push(
          `${relPath} -> ${source} — API routes must go through public shell adapters or registries`
        );
      }
    }
  }

  if (apiRouteViolations.length > 0) {
    for (const violation of apiRouteViolations) {
      fail(`app API ownership violation: ${violation}`);
    }
  } else {
    pass("app API routes respect ownership rules or are explicitly classified shell bridges");
  }

  const reverseImportViolations: string[] = [];
  const rawApiRouteLiteralViolations: string[] = [];
  for (const workspaceRoot of WORKSPACE_ROOTS) {
    const absRoot = resolve(ROOT, workspaceRoot);
    if (!existsSync(absRoot)) continue;

    for (const absFile of walkTsFiles(absRoot)) {
      const relPath = relative(ROOT, absFile);
      const content = readFileSync(absFile, "utf8");
      for (const source of readImports(absFile)) {
        if (source.startsWith("@/")) {
          reverseImportViolations.push(`${relPath} -> ${source}`);
        }
        if (source.includes("apps/app")) {
          reverseImportViolations.push(`${relPath} -> ${source}`);
        }
      }

      if (
        relPath !== CANONICAL_API_ROUTE_FILE &&
        relPath !== "packages/integration-sdk/src/types.ts" &&
        !isTemplateOrTestFile(relPath) &&
        RAW_API_ROUTE_LITERAL_PATTERN.test(content)
      ) {
        rawApiRouteLiteralViolations.push(relPath);
      }
    }
  }

  if (reverseImportViolations.length > 0) {
    for (const violation of reverseImportViolations) {
      fail(`workspace package imports back into apps/app: ${violation}`);
    }
  } else {
    pass("workspace packages do not import back into apps/app");
  }

  if (rawApiRouteLiteralViolations.length > 0) {
    for (const violation of rawApiRouteLiteralViolations) {
      fail(
        `raw /api/integrations or /api/plugins path literal outside canonical route module: ${violation}`
      );
    }
  } else {
    pass("shared code uses canonical integration/plugin route helpers");
  }

  if (failed) {
    process.exit(1);
  }
}

main();
