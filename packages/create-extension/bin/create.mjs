#!/usr/bin/env node

/**
 * create-radarboard-extension
 *
 * Interactive scaffold for creating a new Radarboard extension repository.
 *
 * Usage:
 *   npm create radarboard-extension
 *   npx create-radarboard-extension
 *   pnpm create radarboard-extension
 *
 * Non-interactive:
 *   npx create-radarboard-extension my-tool --integration --plugin --widget
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));

const isInteractive = positional.length === 0 && flags.size === 0;

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function confirm(question) {
  const answer = await prompt(`${question} (y/N) `);
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

// ---------------------------------------------------------------------------
// Gather inputs
// ---------------------------------------------------------------------------

let name;
let hasIntegration;
let hasPlugin;
let hasWidget;

if (isInteractive) {
  console.log("\n🔧 Create Radarboard Extension\n");

  name = await prompt("Extension name (e.g., notion, jira, analytics): ");
  if (!name) {
    console.error("Error: name is required.");
    process.exit(1);
  }

  hasIntegration = await confirm("Include an integration? (connects to external API)");
  hasPlugin = await confirm("Include a plugin? (adds overlay UI / tools)");
  hasWidget = await confirm("Include a widget? (adds dashboard card)");

  if (!hasIntegration && !hasPlugin && !hasWidget) {
    console.error("\nError: select at least one extension type.");
    process.exit(1);
  }

  console.log("");
} else {
  name = positional[0];
  if (!name) {
    console.error(
      "Usage: create-radarboard-extension <name> [--integration] [--plugin] [--widget]"
    );
    process.exit(1);
  }
  hasIntegration = flags.has("--integration");
  hasPlugin = flags.has("--plugin");
  hasWidget = flags.has("--widget");

  if (!hasIntegration && !hasPlugin && !hasWidget) {
    console.error("Error: specify at least one of --integration, --plugin, --widget");
    process.exit(1);
  }
}

const kebab = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
const pascal = kebab
  .split("-")
  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  .join("");
const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);

const repoDir = resolve(".", `radarboard-${kebab}`);

// ---------------------------------------------------------------------------
// File generators
// ---------------------------------------------------------------------------

function generateManifest() {
  const extensions = [];
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
      description: `${pascal} extension for Radarboard`,
      author: { name: "Your Name", url: "https://github.com/yourname" },
      minAppVersion: "1.0.0",
      extensions,
    },
    null,
    2
  );
}

function generateRootPackageJson() {
  return JSON.stringify(
    {
      name: `radarboard-${kebab}`,
      version: "0.1.0",
      private: true,
      description: `Radarboard extension package: ${name}`,
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
    2
  );
}

function generateTsconfig() {
  const include = [];
  if (hasIntegration) include.push("integrations/*/src/**/*");
  if (hasPlugin) include.push("plugins/*/src/**/*");
  if (hasWidget) include.push("widgets/**/*");
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
      },
      include,
      exclude: ["node_modules", "dist", "**/*.test.ts"],
    },
    null,
    2
  );
}

function generateBiome() {
  return JSON.stringify(
    {
      $schema: "https://biomejs.dev/schemas/1.9.0/schema.json",
      organizeImports: { enabled: true },
      linter: { enabled: true, rules: { recommended: true } },
      formatter: { enabled: true, indentStyle: "space", indentWidth: 2, lineWidth: 100 },
    },
    null,
    2
  );
}

function generateIntegrationIndex() {
  return `import type { IntegrationDescriptor } from "@radarboard/integration-sdk";

export const ${camel}Descriptor: IntegrationDescriptor = {
  id: "${kebab}",
  name: "${pascal}",
  description: "Connect ${pascal} to Radarboard",
  icon: "puzzle",
  auth: {
    type: "api-key",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true },
    ],
  },
  dataSources: [],
  mcpTools: [],
};
`;
}

function generatePluginIndex() {
  return `import type { PluginDescriptor } from "@radarboard/plugin-sdk";

export const ${camel}Descriptor: PluginDescriptor = {
  id: "${kebab}",
  name: "${pascal}",
  description: "${pascal} plugin for Radarboard",
  icon: "puzzle",
  presentation: { mode: "overlay", overlay: { title: "${pascal}", width: "md" } },
  component: () => null, // Replace with your overlay component
  settings: [],
};
`;
}

function generateWidgetIndex() {
  return `import type { WidgetDescriptor } from "@radarboard/widget-sdk";
import { kpiRow, list } from "@radarboard/widget-sdk/section-helpers";
import { buildTemplateRecipe, type TemplateRecipeModel, type WidgetTemplateConfig } from "@radarboard/widget-sdk";

const SRC = "${kebab}";

const recipe: TemplateRecipeModel = {
  kind: "summary_list",
  summary: [kpiRow(SRC, [{ label: "Total", field: "totalCount" }])],
  rail: [],
  content: [list(SRC, "items", { title: "title", emptyMessage: "No items yet" })],
};

const config: WidgetTemplateConfig = {
  dataSources: [{ id: SRC }],
  recipe,
  sections: buildTemplateRecipe(recipe),
  expandedRecipe: recipe,
  expandedSections: buildTemplateRecipe(recipe),
};

export const ${camel}Descriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "${kebab}",
  name: "${pascal}",
  description: "TODO: describe your widget",
  requiredIntegrations: [${hasIntegration ? `"${kebab}"` : ""}],
  defaultSlot: "slot8",
  component: () => null,
  expandedComponent: () => null,
  defaultConfig: config,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => config,
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
};
`;
}

function generatePkgJson(type, sdkDep, extraDeps = {}) {
  const prefix = type === "widget" ? "" : "src/";
  return JSON.stringify(
    {
      name: `@radarboard/${type}-${kebab}`,
      version: "0.1.0",
      private: true,
      exports: { ".": `./${prefix}index.ts`, "./types": `./${prefix}types.ts` },
      dependencies: { [sdkDep]: "workspace:*", "@radarboard/types": "workspace:*", ...extraDeps },
      devDependencies: { "@types/react": "^19.0.0", typescript: "^5.5.0", vitest: "^2.0.0" },
      peerDependencies: { react: "^19.0.0" },
    },
    null,
    2
  );
}

function generateTypes() {
  return `export interface ${pascal}Item {\n  id: string;\n  title: string;\n  createdAt: number;\n}\n`;
}

const types = [];
if (hasIntegration) types.push("integration");
if (hasPlugin) types.push("plugin");
if (hasWidget) types.push("widget");

function generateReadme() {
  return `# ${pascal} Extension Package

A Radarboard extension package containing: ${types.join(", ")}.

## Installation

In your Radarboard instance, install via GitHub URL.

## Development

\`\`\`bash
pnpm install && pnpm typecheck && pnpm test
\`\`\`
`;
}

// ---------------------------------------------------------------------------
// Scaffold
// ---------------------------------------------------------------------------

function write(path, content) {
  writeFileSync(path, content, "utf8");
  console.log(`  ${path.replace(`${repoDir}/`, "")}`);
}

console.log(`Scaffolding: ${repoDir}\n`);

mkdirSync(repoDir, { recursive: true });

write(join(repoDir, "package.json"), generateRootPackageJson());
write(join(repoDir, "radarboard-extension.json"), generateManifest());
write(join(repoDir, "tsconfig.json"), generateTsconfig());
write(join(repoDir, "biome.json"), generateBiome());
write(join(repoDir, ".gitignore"), "node_modules/\ndist/\n*.tsbuildinfo\ncoverage/\n");
write(join(repoDir, "README.md"), generateReadme());

if (hasIntegration) {
  const dir = join(repoDir, "integrations", kebab, "src");
  mkdirSync(dir, { recursive: true });
  write(join(dir, "index.ts"), generateIntegrationIndex());
  write(join(dir, "types.ts"), generateTypes());
  write(
    join(dir, "..", "package.json"),
    generatePkgJson("integration", "@radarboard/integration-sdk")
  );
}

if (hasPlugin) {
  const dir = join(repoDir, "plugins", kebab, "src");
  mkdirSync(dir, { recursive: true });
  write(join(dir, "index.ts"), generatePluginIndex());
  write(join(dir, "types.ts"), generateTypes());
  write(
    join(dir, "..", "package.json"),
    generatePkgJson("plugin", "@radarboard/plugin-sdk", { "@radarboard/ui": "workspace:*" })
  );
}

if (hasWidget) {
  const dir = join(repoDir, "widgets", kebab);
  mkdirSync(dir, { recursive: true });
  write(join(dir, "index.ts"), generateWidgetIndex());
  write(join(dir, "types.ts"), generateTypes());
  write(
    join(dir, "package.json"),
    generatePkgJson("widget", "@radarboard/widget-sdk", {
      "@radarboard/widget-engine": "workspace:*",
      "@radarboard/ui": "workspace:*",
    })
  );
}

console.log(`
Done! Next steps:

  cd radarboard-${kebab}
  git init
  pnpm install
  # Implement your extension logic
  # Push to GitHub
  # Install in Radarboard via the GitHub URL
`);
