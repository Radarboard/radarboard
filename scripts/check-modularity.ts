#!/usr/bin/env tsx
/**
 * Modularity audit — detects hardcoded extension references in apps/app.
 *
 * Extensions should only be accessed through the generated init files and
 * SDK registries. Direct imports from extension packages in app-level code
 * create coupling that prevents clean extraction.
 *
 * Run: pnpm check:modularity
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const APP_DIR = join(ROOT, "apps/app");

// Extension package prefixes to scan for
const EXTENSION_PREFIXES = [
  "@radarboard/integration-",
  "@radarboard/plugin-",
  "@radarboard/widget-",
  "@radarboard/feature-",
];

// These are SDKs, not extensions — always allowed
const SDK_PACKAGES = new Set([
  "@radarboard/integration-sdk",
  "@radarboard/plugin-sdk",
  "@radarboard/widget-sdk",
  "@radarboard/widget-engine",
  "@radarboard/feature-sdk",
]);

// Generated files that legitimately import extensions
const GENERATED_FILE_PATTERNS = [
  /\binit\.ts$/,
  /transpile-packages\.ts$/,
];

/**
 * Known tech debt — files with accepted violations.
 * Each entry documents WHY it exists and HOW to fix it.
 * These are reported as warnings, not errors.
 */
const KNOWN_TECH_DEBT: Record<string, string> = {
  // --- Current app/module shell accepted debt ---
  "app/providers.tsx":
    "Direct plugin-webhook-relay background poller import. Fix: register background pollers via plugin lifecycle descriptors.",
  "components/widgets/widget-config-panel/index.tsx":
    "Direct widget-github-stars config import. Fix: expose widget configuration through descriptor metadata.",
  "data/core/client.ts":
    "Direct integration-github star-history import for database repository wiring. Fix: register repository factories through integration capabilities.",
  "data/core/repository.ts":
    "Direct integration-github star-history import for database repository typing. Fix: move shared repository contracts to integration-sdk.",
  "data/providers/sqlite/sqlite-migrate.ts":
    "Direct integration-github star-history import for migrations. Fix: register extension-owned migrations through integration capabilities.",
  "lib/ai-actions/issues/create-github-issue.ts":
    "Direct integration-github import. Fix: use integration registry client lookup.",
  "lib/ai-actions/issues/create-linear-issue.ts":
    "Direct integration-linear import. Fix: use integration registry client lookup.",
  "lib/ai-actions/issues/send-slack-message.ts":
    "Direct integration-slack import. Fix: use integration registry client lookup.",
  "lib/assistant/integration/credential-resolver.ts":
    "Imports type-only configs from integrations. Fix: define a generic CredentialConfig in integration-sdk.",
  "lib/integrations/content/changelog-server.ts":
    "Direct integration-github and plugin-changelog imports. Fix: expose content changelog capability through descriptors.",
  "modules/database-shell/routes/migrate.ts":
    "Direct integration-github star-history import for migration route. Fix: register extension-owned migrations through integration capabilities.",
  "modules/integration-shell/routes/data.ts":
    "Direct integration-github data imports for repo browser and star tracking. Fix: expose through integration route/capability handlers.",
  "modules/notifications-shell/routes/send.ts":
    "Direct integration-resend import. Fix: register alert sender via integration descriptor.",
  "modules/plugin-shell/routes/action.ts":
    "Direct plugin route/action imports. Fix: route plugin actions through descriptor-registered handlers.",
  "modules/plugin-shell/routes/status-page-health.ts":
    "Direct plugin-status-page project health import. Fix: expose project health through plugin descriptor capability.",
  "modules/plugin-shell/routes/webhook-relay-poll.ts":
    "Direct plugin-webhook-relay poll import. Fix: expose poller through plugin descriptor route handler.",
  "modules/provider-shell/plugin-dock.tsx":
    "Direct plugin-status-page import. Fix: read status page config from plugin registry.",
  "modules/provider-shell/rss-reader-background-poller.tsx":
    "Direct plugin-rss-reader background poller import. Fix: register background pollers via plugin lifecycle descriptors.",
  "modules/provider-shell/status-page-background-poller.tsx":
    "Direct plugin-status-page background poller import. Fix: register background pollers via plugin lifecycle descriptors.",

  // --- Server-side plugin logic that needs app DB access ---
  "lib/changelog-server.ts":
    "Direct plugin-changelog imports. Fix: move server logic into plugin package, expose via SDK route handler.",
  "lib/rss-reader-server.ts":
    "Direct plugin-rss-reader imports. Fix: move server logic into plugin package.",
  "lib/project-health-sources.ts":
    "Direct plugin-status-page imports. Fix: use registry lookup for StatusSource type.",
  "lib/status-page-links.ts":
    "Direct plugin-status-page imports. Fix: expose via plugin descriptor capability.",
  "lib/plugin-tool-bridge.ts":
    "Direct plugin-embeddings import. Fix: register embedding resolver via plugin descriptor.",

  // --- AI/assistant tooling that references specific extensions ---
  "lib/ai-tools.ts":
    "Direct feature imports for briefing/workflows tools. Fix: register AI tools via feature descriptor.",
  "lib/ai-actions/create-github-issue.ts":
    "Direct integration-github import. Fix: use integration registry client lookup.",
  "lib/ai-actions/create-linear-issue.ts":
    "Direct integration-linear import. Fix: use integration registry client lookup.",
  "lib/ai-actions/send-slack-message.ts":
    "Direct integration-slack import. Fix: use integration registry client lookup.",
  "lib/assistant-route-runtime.ts":
    "Direct integration-shipping import + hardcoded 'notes' plugin. Fix: use findDataSource() + registry.",

  // --- Credential resolver with typed configs ---
  "lib/credential-resolver.ts":
    "Imports type-only configs from all integrations. Fix: define a generic CredentialConfig in integration-sdk.",

  // --- Plugin-specific UI coupling ---
  "components/plugins/plugin-dock/index.tsx":
    "Direct plugin-status-page imports. Fix: read status page config from plugin registry.",
  "components/plugins/status-page-background-poller/index.tsx":
    "Direct plugin-status-page imports. Fix: register background poller via plugin descriptor lifecycle.",

  // --- Dashboard/onboarding ---

  // --- Settings that reference specific features ---

  // --- Extension-specific API routes ---
  "app/api/github/star-tracking/route.ts":
    "GitHub-specific route. Fix: move into integration-github package, expose via unified route.",
  "app/api/plugins/rss-reader/discover/route.ts":
    "RSS-reader-specific route. Fix: move into plugin-rss-reader, expose via unified route.",
  "app/api/alerts/send/route.ts":
    "Direct integration-resend imports. Fix: register alert sender via integration descriptor.",
  "app/api/briefing/route.ts":
    "Direct feature-briefing imports. Part of briefing feature — acceptable coupling.",
  "app/api/chat/route.ts":
    "Direct feature-briefing import. Fix: register chat tools via feature descriptor.",
  "app/api/embeddings/route.ts":
    "Direct plugin-embeddings imports. Fix: expose via plugin descriptor route handler.",
  "app/api/workflows/route.ts":
    "Direct feature-workflows imports. Part of workflows feature — acceptable coupling.",

  // --- Desktop sync ---
  "hooks/use-tauri-health-sync.ts":
    "Direct widget-observability import. Fix: register health data source via descriptor.",

};

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

interface Violation {
  file: string;
  line: number;
  import: string;
  isTechDebt: boolean;
  techDebtReason?: string;
}

function isGeneratedFile(filePath: string): boolean {
  return GENERATED_FILE_PATTERNS.some((p) => p.test(filePath));
}

function isExtensionImport(importSource: string): boolean {
  if (SDK_PACKAGES.has(importSource)) return false;
  // Check against prefixes (strip subpath)
  const base = importSource.split("/").slice(0, 2).join("/");
  if (SDK_PACKAGES.has(base)) return false;
  return EXTENSION_PREFIXES.some((p) => importSource.startsWith(p));
}

function scanFile(filePath: string, relPath: string): Violation[] {
  if (isGeneratedFile(filePath)) return [];
  if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) return [];

  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const violations: Violation[] = [];
  const importRegex = /(?:from|import)\s+["'](@radarboard\/[^"']+)["']/g;

  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(lines[i])) !== null) {
      const imp = match[1];
      if (isExtensionImport(imp)) {
        const techDebtKey = Object.keys(KNOWN_TECH_DEBT).find((k) => relPath.endsWith(k));
        violations.push({
          file: relPath,
          line: i + 1,
          import: imp,
          isTechDebt: !!techDebtKey,
          techDebtReason: techDebtKey ? KNOWN_TECH_DEBT[techDebtKey] : undefined,
        });
      }
    }
  }

  return violations;
}

function walkDir(dir: string, files: string[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".turbo") continue;
      walkDir(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const files: string[] = [];
  walkDir(APP_DIR, files);

  const allViolations: Violation[] = [];
  for (const file of files) {
    const relPath = file.replace(`${APP_DIR}/`, "");
    allViolations.push(...scanFile(file, relPath));
  }

  const techDebt = allViolations.filter((v) => v.isTechDebt);
  const newViolations = allViolations.filter((v) => !v.isTechDebt);

  console.log("╭─────────────────────────────────────────────────╮");
  console.log("│           Modularity Audit Report               │");
  console.log("╰─────────────────────────────────────────────────╯\n");

  if (newViolations.length > 0) {
    console.log(`\x1b[31mNew violations (${newViolations.length}):\x1b[0m`);
    console.log("These are direct extension imports not in the known tech debt list.\n");
    for (const v of newViolations) {
      console.log(`  \x1b[31m✗\x1b[0m ${v.file}:${v.line} — imports "${v.import}"`);
    }
    console.log("\nTo fix: use the SDK registry instead of direct imports.");
    console.log("If this is intentional tech debt, add the file to KNOWN_TECH_DEBT in check-modularity.ts.\n");
  }

  if (techDebt.length > 0) {
    const uniqueFiles = [...new Set(techDebt.map((v) => v.file))];
    console.log(`Known accepted modularity debt (${techDebt.length} imports in ${uniqueFiles.length} files):\n`);
    for (const file of uniqueFiles) {
      const fileViolations = techDebt.filter((v) => v.file === file);
      const reason = fileViolations[0]?.techDebtReason;
      console.log(`  - ${file} (${fileViolations.length} imports)`);
      if (reason) console.log(`    ${reason}`);
    }
    console.log();
  }

  // Summary
  console.log("─────────────────────────────────────────────────");
  console.log(`Files scanned: ${files.length}`);
  console.log(`\x1b[31m✗ ${newViolations.length} new violations\x1b[0m  ${techDebt.length} accepted known debt`);
  console.log("─────────────────────────────────────────────────\n");

  if (newViolations.length > 0) {
    console.error("\x1b[31mModularity check failed. New direct extension imports detected.\x1b[0m");
    console.error("Extensions must only be accessed through registries and generated init files.\n");
    process.exit(1);
  }

  if (techDebt.length > 0) {
    console.log(`${uniqueFiles(techDebt).length} files still have accepted modularity debt — see above for fix suggestions.`);
  } else {
    console.log("\x1b[32mFully modular — no direct extension imports.\x1b[0m");
  }
}

function uniqueFiles(violations: Violation[]): string[] {
  return [...new Set(violations.map((v) => v.file))];
}

main();
