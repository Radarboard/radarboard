#!/usr/bin/env tsx
/**
 * Scaffold a new external extension repository.
 *
 * Generates a standalone repo structure that can contain one or more
 * extension types (integration, plugin, widget) with a radarboard-extension.json
 * manifest. The resulting repo can be installed via GitHub URL.
 *
 * Usage:
 *   pnpm scaffold:extension-repo <name> [--integration] [--plugin] [--widget] [--out <dir>]
 *
 * Examples:
 *   pnpm scaffold:extension-repo notion --integration --plugin --widget
 *   pnpm scaffold:extension-repo analytics --widget --out ~/projects
 *   pnpm scaffold:extension-repo github-extra --plugin
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));

if (!name) {
  console.error("Usage: scaffold:extension-repo <name> [--integration] [--plugin] [--widget] [--out <dir>]");
  console.error("");
  console.error("Examples:");
  console.error("  pnpm scaffold:extension-repo notion --integration --plugin --widget");
  console.error("  pnpm scaffold:extension-repo analytics --widget");
  process.exit(1);
}

const hasIntegration = args.includes("--integration");
const hasPlugin = args.includes("--plugin");
const hasWidget = args.includes("--widget");

if (!hasIntegration && !hasPlugin && !hasWidget) {
  console.error("Error: specify at least one of --integration, --plugin, --widget");
  process.exit(1);
}

const outIdx = args.indexOf("--out");
const outDir = outIdx !== -1 ? resolve(args[outIdx + 1] ?? ".") : resolve(".");

const kebab = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pascal = kebab
  .split("-")
  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  .join("");

const repoDir = join(outDir, `radarboard-${kebab}`);

// ---------------------------------------------------------------------------
// File generators
// ---------------------------------------------------------------------------

function generateRootPackageJson(): string {
  return JSON.stringify(
    {
      name: `radarboard-${kebab}`,
      version: "0.1.0",
      private: true,
      description: `Radarboard extension package for ${name}`,
      license: "MIT",
      scripts: {
        lint: "biome check .",
        "lint:fix": "biome check --write .",
        typecheck: "tsc --noEmit",
        test: "vitest run",
        build: "tsc",
      },
      devDependencies: {
        "@biomejs/biome": "^1.9.0",
        typescript: "^5.5.0",
        vitest: "^2.0.0",
      },
    },
    null,
    2,
  );
}

function generateManifest(): string {
  const extensions: Array<{ type: string; path: string; name: string; required: boolean }> = [];

  if (hasIntegration) {
    extensions.push({
      type: "integration",
      path: `integrations/${kebab}`,
      name: `@radarboard/integration-${kebab}`,
      required: true,
    });
  }
  if (hasPlugin) {
    extensions.push({
      type: "plugin",
      path: `plugins/${kebab}`,
      name: `@radarboard/plugin-${kebab}`,
      required: true,
    });
  }
  if (hasWidget) {
    extensions.push({
      type: "widget",
      path: `widgets/${kebab}`,
      name: `@radarboard/widget-${kebab}`,
      required: true,
    });
  }

  return JSON.stringify(
    {
      name: `${pascal} Extension Package`,
      description: `${pascal} integration for Radarboard`,
      author: { name: "Your Name", url: "https://github.com/yourname" },
      minAppVersion: "1.0.0",
      extensions,
    },
    null,
    2,
  );
}

function generateTsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        outDir: "dist",
        declaration: true,
        declarationMap: true,
        sourceMap: true,
      },
      include: ["integrations/*/src/**/*", "plugins/*/src/**/*", "widgets/**/*"],
      exclude: ["node_modules", "dist", "**/*.test.ts"],
    },
    null,
    2,
  );
}

function generateBiomeConfig(): string {
  return JSON.stringify(
    {
      $schema: "https://biomejs.dev/schemas/1.9.0/schema.json",
      organizeImports: { enabled: true },
      linter: {
        enabled: true,
        rules: { recommended: true },
      },
      formatter: {
        enabled: true,
        indentStyle: "space",
        indentWidth: 2,
        lineWidth: 100,
      },
    },
    null,
    2,
  );
}

function generateIntegrationIndex(): string {
  return `/**
 * ${pascal} — Integration Descriptor
 *
 * Registers the ${pascal} integration with Radarboard, defining:
 * - Auth configuration (OAuth or API key)
 * - Data sources that widgets can consume
 * - MCP tools for AI assistant access
 */

import type {
  IntegrationDescriptor,
  DataSourceDefinition,
} from "@radarboard/integration-sdk";

const dataSources: DataSourceDefinition[] = [
  {
    id: "${kebab}",
    name: "${pascal} Data",
    description: "Fetches data from ${pascal}",
    // Implement your data fetching logic in a data-sources file
    resolve: async (_context) => {
      return { items: [], totalCount: 0 };
    },
  },
];

export const ${pascal.charAt(0).toLowerCase() + pascal.slice(1)}Descriptor: IntegrationDescriptor = {
  id: "${kebab}",
  name: "${pascal}",
  description: "Connect your ${pascal} account to Radarboard",
  icon: "puzzle",
  auth: {
    type: "api-key",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        required: true,
        helpText: "Find your API key in ${pascal} settings",
      },
    ],
  },
  dataSources,
  mcpTools: [],
};
`;
}

function generateIntegrationPackageJson(): string {
  return JSON.stringify(
    {
      name: `@radarboard/integration-${kebab}`,
      version: "0.1.0",
      private: true,
      exports: {
        ".": "./src/index.ts",
        "./types": "./src/types.ts",
      },
      dependencies: {
        "@radarboard/integration-sdk": "workspace:*",
        "@radarboard/utils": "workspace:*",
      },
      devDependencies: {
        typescript: "^5.5.0",
        vitest: "^2.0.0",
      },
      peerDependencies: {
        react: "^19.0.0",
      },
    },
    null,
    2,
  );
}

function generatePluginIndex(): string {
  return `/**
 * ${pascal} — Plugin Descriptor
 *
 * Registers the ${pascal} plugin overlay and services with Radarboard.
 */

import type { PluginDescriptor } from "@radarboard/plugin-sdk";

export const ${pascal.charAt(0).toLowerCase() + pascal.slice(1)}Descriptor: PluginDescriptor = {
  id: "${kebab}",
  name: "${pascal}",
  description: "${pascal} plugin for Radarboard",
  icon: "puzzle",
  presentation: {
    mode: "overlay",
    overlay: {
      title: "${pascal}",
      width: "md",
    },
  },
  component: () => null, // Replace with your overlay component
  settings: [],
};
`;
}

function generatePluginPackageJson(): string {
  return JSON.stringify(
    {
      name: `@radarboard/plugin-${kebab}`,
      version: "0.1.0",
      private: true,
      exports: {
        ".": "./src/index.ts",
        "./types": "./src/types.ts",
      },
      dependencies: {
        "@radarboard/plugin-sdk": "workspace:*",
        "@radarboard/types": "workspace:*",
        "@radarboard/ui": "workspace:*",
        "@radarboard/utils": "workspace:*",
      },
      devDependencies: {
        "@types/react": "^19.0.0",
        typescript: "^5.5.0",
        vitest: "^2.0.0",
      },
      peerDependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
    },
    null,
    2,
  );
}

function generateWidgetIndex(): string {
  return `/**
 * ${pascal} — Widget Descriptor
 *
 * Uses template sections and recipe model for declarative widget composition.
 * Section helpers provide a shorthand for building sections.
 */

import {
  buildTemplateRecipe,
  type TemplateRecipeModel,
  type WidgetTemplateConfig,
} from "@radarboard/widget-sdk";
import type { WidgetDescriptor } from "@radarboard/widget-sdk";
import { kpiRow, list } from "@radarboard/widget-sdk/section-helpers";

const SRC = "${kebab}";

const recipe: TemplateRecipeModel = {
  kind: "summary_list",
  summary: [
    kpiRow(SRC, [
      { label: "Total", field: "totalCount" },
      { label: "Active", field: "activeCount" },
    ]),
  ],
  rail: [],
  content: [
    list(SRC, "items", {
      title: "title",
      subtitle: "subtitle",
      emptyMessage: "No items yet",
    }),
  ],
};

const templateConfig: WidgetTemplateConfig = {
  dataSources: [{ id: SRC }],
  recipe,
  sections: buildTemplateRecipe(recipe),
  expandedRecipe: recipe,
  expandedSections: buildTemplateRecipe(recipe),
};

export const ${pascal.charAt(0).toLowerCase() + pascal.slice(1)}Descriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "${kebab}",
  name: "${pascal}",
  description: "TODO: Add a description",
  requiredIntegrations: [${hasIntegration ? `"${kebab}"` : ""}],
  defaultSlot: "slot8",
  component: () => null, // Replace with your compact component
  expandedComponent: () => null, // Replace with your expanded component
  defaultConfig: templateConfig,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => config,
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
};
`;
}

function generateWidgetPackageJson(): string {
  return JSON.stringify(
    {
      name: `@radarboard/widget-${kebab}`,
      version: "0.1.0",
      private: true,
      exports: {
        ".": "./index.ts",
        "./types": "./types.ts",
      },
      dependencies: {
        "@radarboard/widget-sdk": "workspace:*",
        "@radarboard/widget-engine": "workspace:*",
        "@radarboard/types": "workspace:*",
        "@radarboard/utils": "workspace:*",
        "@radarboard/ui": "workspace:*",
      },
      devDependencies: {
        "@types/react": "^19.0.0",
        typescript: "^5.5.0",
        vitest: "^2.0.0",
      },
      peerDependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
    },
    null,
    2,
  );
}

function generateTypes(): string {
  return `/**
 * Shared types for the ${pascal} extension package.
 */

export interface ${pascal}Item {
  id: string;
  title: string;
  subtitle?: string;
  createdAt: number;
}
`;
}

function generateGitignore(): string {
  return `node_modules/
dist/
*.tsbuildinfo
.turbo/
coverage/
`;
}

function generateReadme(): string {
  const types: string[] = [];
  if (hasIntegration) types.push("integration");
  if (hasPlugin) types.push("plugin");
  if (hasWidget) types.push("widget");

  return `# ${pascal} Extension Package

A Radarboard extension package containing: ${types.join(", ")}.

## Installation

In your Radarboard instance, install from GitHub URL:

\`\`\`
https://github.com/yourname/radarboard-${kebab}
\`\`\`

## Development

\`\`\`bash
# Install dependencies
pnpm install

# Run type checking
pnpm typecheck

# Run tests
pnpm test

# Lint
pnpm lint
\`\`\`

## Structure

\`\`\`
${hasIntegration ? `integrations/${kebab}/    # Integration: auth, data sources, MCP tools\n` : ""}${hasPlugin ? `plugins/${kebab}/          # Plugin: overlay UI, services\n` : ""}${hasWidget ? `widgets/${kebab}/          # Widget: dashboard card\n` : ""}radarboard-extension.json  # Package manifest
\`\`\`

## License

MIT
`;
}

// ---------------------------------------------------------------------------
// Scaffold
// ---------------------------------------------------------------------------

function writeFile(path: string, content: string) {
  writeFileSync(path, content, "utf8");
  console.log(`  created ${path.replace(repoDir + "/", "")}`);
}

console.log(`\nScaffolding extension repo: ${repoDir}\n`);

mkdirSync(repoDir, { recursive: true });

// Root files
writeFile(join(repoDir, "package.json"), generateRootPackageJson());
writeFile(join(repoDir, "radarboard-extension.json"), generateManifest());
writeFile(join(repoDir, "tsconfig.json"), generateTsconfig());
writeFile(join(repoDir, "biome.json"), generateBiomeConfig());
writeFile(join(repoDir, ".gitignore"), generateGitignore());
writeFile(join(repoDir, "README.md"), generateReadme());

// Integration
if (hasIntegration) {
  const dir = join(repoDir, "integrations", kebab, "src");
  mkdirSync(dir, { recursive: true });
  writeFile(join(dir, "index.ts"), generateIntegrationIndex());
  writeFile(join(dir, "types.ts"), generateTypes());
  writeFile(join(dir, "..", "package.json"), generateIntegrationPackageJson());
}

// Plugin
if (hasPlugin) {
  const dir = join(repoDir, "plugins", kebab, "src");
  mkdirSync(dir, { recursive: true });
  writeFile(join(dir, "index.ts"), generatePluginIndex());
  writeFile(join(dir, "types.ts"), generateTypes());
  writeFile(join(dir, "..", "package.json"), generatePluginPackageJson());
}

// Widget
if (hasWidget) {
  const dir = join(repoDir, "widgets", kebab);
  mkdirSync(dir, { recursive: true });
  writeFile(join(dir, "index.ts"), generateWidgetIndex());
  writeFile(join(dir, "types.ts"), generateTypes());
  writeFile(join(dir, "package.json"), generateWidgetPackageJson());
}

console.log(`\nDone! Extension repo scaffolded at: ${repoDir}`);
console.log("\nNext steps:");
console.log("  1. cd " + repoDir);
console.log("  2. git init && pnpm install");
console.log("  3. Implement your extension logic");
console.log("  4. Push to GitHub");
console.log("  5. Install in Radarboard via the GitHub URL\n");
