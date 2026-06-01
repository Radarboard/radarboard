import { existsSync } from "node:fs";
import { resolve } from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../packages/tsconfig/vitest.shared";

function findExistingModule(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const fileCandidate = resolve(__dirname, `${candidate}.ts`);
    const fileTsxCandidate = resolve(__dirname, `${candidate}.tsx`);
    const indexTsCandidate = resolve(__dirname, candidate, "index.ts");
    const indexTsxCandidate = resolve(__dirname, candidate, "index.tsx");

    if (existsSync(fileCandidate)) return fileCandidate;
    if (existsSync(fileTsxCandidate)) return fileTsxCandidate;
    if (existsSync(indexTsCandidate)) return indexTsCandidate;
    if (existsSync(indexTsxCandidate)) return indexTsxCandidate;
  }

  return null;
}

const libCandidateRoots = [
  "lib",
  "lib/assistant",
  "lib/assistant/core",
  "lib/assistant/integration",
  "lib/assistant/knowledge",
  "lib/auth",
  "lib/auth/oauth",
  "lib/extensions",
  "lib/extensions/runtime",
  "lib/integrations",
  "lib/integrations/config",
  "lib/integrations/content",
  "lib/integrations/status",
  "lib/layout",
  "lib/layout/runtime",
  "lib/licensing",
  "lib/mcp",
  "lib/notifications",
  "lib/shortcuts",
  "lib/system",
  "lib/system/config",
  "lib/system/events",
  "lib/system/polling",
  "lib/system/runtime",
  "lib/system/ui",
  "lib/utils",
  "lib/utils/core",
  "lib/utils/control",
  "lib/extension-installer",
] as const;

const dbCandidateRoots = [
  "data",
  "data/core",
  "data/cache",
  "data/credentials",
  "data/debug",
  "data/extensions",
  "data/llm",
  "data/settings",
  "data/providers/sqlite",
] as const;

const appStructureResolver = {
  name: "radarboard-app-structure-resolver",
  enforce: "pre" as const,
  resolveId(source: string) {
    if (source.startsWith("@/lib/")) {
      const suffix = source.slice(6);
      return findExistingModule(libCandidateRoots.map((root) => `${root}/${suffix}`));
    }

    if (source.startsWith("@/db/")) {
      const suffix = source.slice(5);
      return findExistingModule(dbCandidateRoots.map((root) => `${root}/${suffix}`));
    }

    return null;
  },
};

const exactAliases = {
  "@/lib/ai-actions/export-report": "lib/ai-actions/reports/export-report",
  "@/lib/api": "lib/utils/core/api",
  "@/lib/assistant-context-cache": "lib/assistant/core/assistant-context-cache",
  "@/lib/assistant-route-runtime": "lib/assistant/core/assistant-route-runtime",
  "@/lib/ai-tools": "lib/assistant/core/ai-tools",
  "@/lib/auto-embed": "lib/assistant/integration/auto-embed",
  "@/lib/backup-tasks": "lib/assistant/integration/backup-tasks",
  "@/lib/conversation-extractor": "lib/assistant/knowledge/conversation-extractor",
  "@/lib/credential-resolver": "lib/assistant/integration/credential-resolver",
  "@/lib/data-source-context": "lib/assistant/core/data-source-context",
  "@/lib/embedding-service-singleton": "lib/assistant/core/embedding-service-singleton",
  "@/lib/knowledge-health": "lib/assistant/knowledge/knowledge-health",
  "@/lib/memory-service": "lib/assistant/knowledge/memory-service",
  "@/lib/plugin-tool-bridge": "lib/assistant/core/plugin-tool-bridge",
  "@/lib/changelog-server": "lib/integrations/content/changelog-server",
  "@/lib/integration-artifacts": "lib/integrations/config/integration-artifacts",
  "@/lib/integration-connections": "lib/integrations/config/integration-connections",
  "@/lib/integration-data-invalidation": "lib/integrations/config/integration-data-invalidation",
  "@/lib/integration-rss-feeds": "lib/integrations/content/integration-rss-feeds",
  "@/lib/integration-status-pages": "lib/integrations/status/integration-status-pages",
  "@/lib/project-health-sources": "lib/integrations/status/project-health-sources",
  "@/lib/rss-reader-server": "lib/integrations/content/rss-reader-server",
  "@/lib/service-favicons": "lib/integrations/status/service-favicons",
  "@/lib/status-page-links": "lib/integrations/status/status-page-links",
  "@/lib/features": "lib/extensions/runtime/features",
  "@/lib/features-init": "lib/extensions/runtime/features-init",
  "@/lib/integrations-init": "lib/extensions/runtime/integrations-init",
  "@/lib/plugins-init": "lib/extensions/runtime/plugins-init",
  "@/lib/transpile-packages": "lib/extensions/runtime/transpile-packages",
  "@/lib/widgets-init": "lib/extensions/runtime/widgets-init",
  "@/lib/env": "lib/system/runtime/env",
  "@/lib/e2e": "lib/system/runtime/e2e",
  "@/lib/platform": "lib/system/runtime/platform",
  "@/lib/providers": "lib/system/runtime/providers",
  "@/lib/runtime-data-paths": "lib/system/runtime/runtime-data-paths",
  "@/lib/client-debug": "lib/system/ui/client-debug",
  "@/lib/demo-data": "lib/system/ui/demo-data",
  "@/lib/dev-extensions-init": "lib/system/ui/dev-extensions-init",
  "@/lib/dialog": "lib/system/ui/dialog",
  "@/lib/tauri-updater": "lib/system/ui/tauri-updater",
  "@/lib/clipboard": "lib/system/ui/clipboard",
  "@/lib/radarboard-config": "lib/system/config/radarboard-config",
  "@/lib/plugin-token": "lib/system/config/plugin-token",
  "@/lib/debug-events": "lib/system/events/debug-events",
  "@/lib/event-gateway": "lib/system/events/event-gateway",
  "@/lib/health-tracker": "lib/system/events/health-tracker",
  "@/lib/offline-sync": "lib/system/polling/offline-sync",
  "@/lib/polling-config": "lib/system/polling/polling-config",
  "@/lib/polling-settings": "lib/system/polling/polling-settings",
  "@/lib/workflow-scheduler-runtime": "lib/system/polling/workflow-scheduler-runtime",
  "@/lib/circuit-breaker": "lib/utils/control/circuit-breaker",
  "@/lib/generate-secret": "lib/utils/core/generate-secret",
  "@/lib/outbound-rate-limit": "lib/utils/control/outbound-rate-limit",
  "@/lib/rate-limit": "lib/utils/control/rate-limit",
  "@/lib/retry": "lib/utils/control/retry",
  "@/lib/session-mutex": "lib/utils/control/session-mutex",
  "@/lib/shutdown": "lib/utils/control/shutdown",
  "@/lib/layout-utils": "lib/layout/runtime/layout-utils",
  "@/lib/project-routes": "lib/layout/runtime/project-routes",
  "@/lib/template-editor": "lib/layout/runtime/template-editor",
  "@/lib/license": "lib/licensing/license",
  "@/lib/license-crypto": "lib/licensing/license-crypto",
  "@/lib/license-email": "lib/licensing/license-email",
  "@/lib/lemonsqueezy": "lib/licensing/lemonsqueezy",
  "@/lib/mcp-bridge": "lib/mcp/mcp-bridge",
  "@/lib/mcp-client": "lib/mcp/mcp-client",
  "@/lib/mcp-oauth": "lib/mcp/mcp-oauth",
  "@/lib/mcp-server-config": "lib/mcp/mcp-server-config",
  "@/lib/named-mcp-client": "lib/mcp/named-mcp-client",
  "@/lib/notification-glob": "lib/notifications/notification-glob",
  "@/lib/notification-open-url": "lib/notifications/notification-open-url",
  "@/lib/notification-webhooks": "lib/notifications/notification-webhooks",
  "@/lib/notifications": "lib/notifications/notifications",
  "@/db/repository": "data/core/repository",
  "@/db/client": "data/core/client",
  "@/db/schema": "data/core/schema",
  "@/db/cache": "data/core/cache",
  "@/db/sqlite-migrate": "data/providers/sqlite/sqlite-migrate",
  "@/db/sqlite-installed-extensions": "data/extensions/sqlite-installed-extensions",
  "@/db/sqlite-extension-usage": "data/extensions/sqlite-extension-usage",
} as const;

const alias = [
  ...Object.entries(exactAliases).map(([find, replacement]) => ({
    find,
    replacement: resolve(__dirname, replacement),
  })),
  {
    find: /^@\/data\/core\/(.*)$/,
    replacement: `${resolve(__dirname, "data/core")}/$1`,
  },
  {
    find: /^@\/data\/cache\/(.*)$/,
    replacement: `${resolve(__dirname, "data/cache")}/$1`,
  },
  {
    find: /^@\/data\/credentials\/(.*)$/,
    replacement: `${resolve(__dirname, "data/credentials")}/$1`,
  },
  {
    find: /^@\/data\/debug\/(.*)$/,
    replacement: `${resolve(__dirname, "data/debug")}/$1`,
  },
  {
    find: /^@\/data\/extensions\/(.*)$/,
    replacement: `${resolve(__dirname, "data/extensions")}/$1`,
  },
  {
    find: /^@\/data\/llm\/(.*)$/,
    replacement: `${resolve(__dirname, "data/llm")}/$1`,
  },
  {
    find: /^@\/data\/providers\/sqlite\/(.*)$/,
    replacement: `${resolve(__dirname, "data/providers/sqlite")}/$1`,
  },
  {
    find: /^@\/data\/settings\/(.*)$/,
    replacement: `${resolve(__dirname, "data/settings")}/$1`,
  },
  {
    find: /^@\/lib\/assistant\/(.*)$/,
    replacement: `${resolve(__dirname, "lib/assistant")}/$1`,
  },
  {
    find: /^@\/lib\/extensions\/(.*)$/,
    replacement: `${resolve(__dirname, "lib/extensions")}/$1`,
  },
  {
    find: /^@\/lib\/integrations\/(.*)$/,
    replacement: `${resolve(__dirname, "lib/integrations")}/$1`,
  },
  {
    find: /^@\/lib\/layout\/(.*)$/,
    replacement: `${resolve(__dirname, "lib/layout")}/$1`,
  },
  {
    find: /^@\/lib\/notifications\/(.*)$/,
    replacement: `${resolve(__dirname, "lib/notifications")}/$1`,
  },
  {
    find: /^@\/lib\/system\/(.*)$/,
    replacement: `${resolve(__dirname, "lib/system")}/$1`,
  },
  {
    find: /^@\/lib\/utils\/(.*)$/,
    replacement: `${resolve(__dirname, "lib/utils")}/$1`,
  },
  {
    find: /^@\/lib\/oauth\/(.*)$/,
    replacement: `${resolve(__dirname, "lib/auth/oauth")}/$1`,
  },
  {
    find: /^@\/lib\/ai-actions\/(.*)$/,
    replacement: `${resolve(__dirname, "lib/ai-actions")}/$1`,
  },
  {
    find: /^@\/db\/(planetscale-cache|sqlite-cache|supabase-cache|turso-cache)$/,
    replacement: `${resolve(__dirname, "data/cache")}/$1`,
  },
  {
    find: /^@\/db\/(planetscale-credentials|sqlite-credentials|supabase-credentials|turso-credentials)$/,
    replacement: `${resolve(__dirname, "data/credentials")}/$1`,
  },
  {
    find: /^@\/db\/(planetscale-debug|sqlite-debug|supabase-debug|turso-debug)$/,
    replacement: `${resolve(__dirname, "data/debug")}/$1`,
  },
  {
    find: /^@\/db\/(planetscale-llm|sqlite-llm|supabase-llm|turso-llm)$/,
    replacement: `${resolve(__dirname, "data/llm")}/$1`,
  },
  {
    find: /^@\/db\/(planetscale-settings|sqlite-settings|supabase-settings|turso-settings)$/,
    replacement: `${resolve(__dirname, "data/settings")}/$1`,
  },
  {
    find: /^@\/db\/(sqlite-notifications|sqlite-plugins)$/,
    replacement: `${resolve(__dirname, "data/providers/sqlite")}/$1`,
  },
  {
    find: "@",
    replacement: resolve(__dirname, "."),
  },
];

export default mergeConfig(
  sharedConfig,
  defineConfig({
    plugins: [tsconfigPaths({ root: __dirname }), appStructureResolver],
    esbuild: {
      // Use react-jsx transform (not Next's "preserve") so JSX in .tsx test files compiles
      tsconfigRaw: {
        compilerOptions: {
          jsx: "react-jsx",
          jsxImportSource: "react",
        },
      },
    },
    test: {
      include: [
        "db/**/*.test.ts",
        "lib/**/*.test.ts",
        "hooks/**/*.test.ts",
        "hooks/**/*.test.tsx",
        "app/**/*.test.ts",
        "modules/**/*.test.ts",
        "components/**/*.test.ts",
        "components/**/*.test.tsx",
        "../../packages/assistant-ui/src/**/*.test.ts",
        "../../packages/assistant-ui/src/**/*.test.tsx",
      ],
      coverage: {
        include: ["db/**/*.ts", "lib/**/*.ts", "hooks/**/*.ts", "app/api/**/*.ts"],
        exclude: [
          "**/*.test.ts",
          "**/*.test.tsx",
          "**/*.d.ts",
          "db/migrations/**",
          "db/schema.ts",
          "db/client.ts",
          "lib/mock-data.ts",
          "lib/providers.ts",
          "app/api/alerts/**",
        ],
      },
    },
    resolve: {
      alias,
    },
  })
);
