#!/usr/bin/env tsx
/**
 * Generate Mintlify .mdx API reference pages from SDK TypeScript sources.
 *
 * Uses ts-morph to parse exported interfaces, types, functions, and enums,
 * extracting JSDoc comments and generating structured documentation.
 *
 * Usage:
 *   pnpm docs:sdk           — generate docs
 *   pnpm docs:sdk --check   — verify generated docs are up to date (CI)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  Project,
  type SourceFile,
  type InterfaceDeclaration,
  type TypeAliasDeclaration,
  type FunctionDeclaration,
  type EnumDeclaration,
  type PropertySignature,
  type JSDoc,
  SyntaxKind,
} from "ts-morph";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const OUTPUT_DIR = join(ROOT, "apps/docs/developer-guide/sdk-reference");
const CHECK_MODE = process.argv.includes("--check");

// ---------------------------------------------------------------------------
// SDK definitions — which modules to document per SDK
// ---------------------------------------------------------------------------

interface SdkModule {
  /** Subpath export key (e.g. "./types", "./registry") */
  subpath: string;
  /** Source file path relative to package root */
  file: string;
}

interface SdkConfig {
  packageName: string;
  packageDir: string;
  outputFile: string;
  title: string;
  description: string;
  modules: SdkModule[];
}

const SDKS: SdkConfig[] = [
  {
    packageName: "@radarboard/integration-sdk",
    packageDir: "packages/integration-sdk",
    outputFile: "integration-sdk.mdx",
    title: "Integration SDK Reference",
    description: "API reference for @radarboard/integration-sdk — descriptors, auth, data sources, and testing utilities.",
    modules: [
      { subpath: "./types", file: "src/types.ts" },
      { subpath: "./registry", file: "src/registry.ts" },
      { subpath: "./routes", file: "src/routes.ts" },
      { subpath: "./testing", file: "src/testing.ts" },
    ],
  },
  {
    packageName: "@radarboard/plugin-sdk",
    packageDir: "packages/plugin-sdk",
    outputFile: "plugin-sdk.mdx",
    title: "Plugin SDK Reference",
    description: "API reference for @radarboard/plugin-sdk — descriptors, PluginAPI, intents, MCP tools, and testing.",
    modules: [
      { subpath: "./types", file: "src/types.ts" },
      { subpath: "./registry", file: "src/registry.ts" },
      { subpath: "./intent-bus", file: "src/intent-bus.ts" },
      { subpath: "./crud-helpers", file: "src/crud-helpers.ts" },
      { subpath: "./testing", file: "src/testing.ts" },
    ],
  },
  {
    packageName: "@radarboard/plugin-sdk",
    packageDir: "packages/plugin-sdk",
    outputFile: "plugin-sdk-components.mdx",
    title: "Plugin SDK Components",
    description: "React component library for building plugin UIs — layout, lists, forms, and three-pane workspaces.",
    modules: [
      { subpath: "./components/detail-shell", file: "src/components/detail-shell.tsx" },
      { subpath: "./components/filter-bar", file: "src/components/filter-bar.tsx" },
      { subpath: "./components/form-dialog", file: "src/components/form-dialog.tsx" },
      { subpath: "./components/list-header", file: "src/components/list-header.tsx" },
      { subpath: "./components/list-row", file: "src/components/list-row.tsx" },
      { subpath: "./components/list-tabs", file: "src/components/list-tabs.tsx" },
      { subpath: "./components/three-pane-workspace", file: "src/components/three-pane-workspace.tsx" },
    ],
  },
  {
    packageName: "@radarboard/widget-sdk",
    packageDir: "packages/widget-sdk",
    outputFile: "widget-sdk.mdx",
    title: "Widget SDK Reference",
    description: "API reference for @radarboard/widget-sdk — template config, recipes, section helpers, and testing.",
    modules: [
      { subpath: "./types", file: "src/types.ts" },
      { subpath: "./widget-types", file: "src/widget-types.ts" },
      { subpath: "./recipes", file: "src/recipes.ts" },
      { subpath: "./section-helpers", file: "src/section-helpers.ts" },
      { subpath: "./testing", file: "src/testing.ts" },
    ],
  },
  {
    packageName: "@radarboard/widget-sdk",
    packageDir: "packages/widget-sdk",
    outputFile: "widget-sdk-composition.mdx",
    title: "Widget SDK Composition",
    description: "Composition catalog, recipe model, data source registry, and variant utilities.",
    modules: [
      { subpath: "./composition-catalog", file: "src/composition-catalog/index.ts" },
      { subpath: "./recipe-model", file: "src/recipe-model/index.ts" },
      { subpath: "./data-source-registry", file: "src/data-source-registry.ts" },
      { subpath: "./variant-utils", file: "src/variant-utils.ts" },
    ],
  },
];

// ---------------------------------------------------------------------------
// ts-morph helpers
// ---------------------------------------------------------------------------

function getJsDocText(jsDocs: JSDoc[]): string {
  if (jsDocs.length === 0) return "";
  return jsDocs
    .map((doc) => doc.getDescription().trim())
    .filter(Boolean)
    .join("\n\n");
}

function getJsDocExample(jsDocs: JSDoc[]): string | null {
  for (const doc of jsDocs) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() === "example") {
        const text = tag.getCommentText()?.trim();
        if (text) return text;
      }
    }
  }
  return null;
}

function formatType(typeText: string): string {
  // Simplify long import types
  return typeText
    .replace(/import\("[^"]+"\)\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Generators for each declaration kind
// ---------------------------------------------------------------------------

function generateInterface(decl: InterfaceDeclaration): string {
  const name = decl.getName();
  const jsDocs = decl.getJsDocs();
  const desc = getJsDocText(jsDocs);
  const example = getJsDocExample(jsDocs);
  const extends_ = decl.getExtends().map((e) => e.getText());

  const lines: string[] = [];
  lines.push(`### \`${name}\``);
  lines.push("");
  if (desc) lines.push(desc);
  if (extends_.length > 0) {
    lines.push("");
    lines.push(`Extends: ${extends_.map((e) => `\`${formatType(e)}\``).join(", ")}`);
  }
  lines.push("");

  const props = decl.getProperties();
  if (props.length > 0) {
    lines.push("| Property | Type | Description |");
    lines.push("|----------|------|-------------|");
    for (const prop of props) {
      const propName = prop.getName();
      const optional = prop.hasQuestionToken() ? "?" : "";
      const propType = formatType(prop.getType().getText(prop));
      const propJsDocs = prop.getJsDocs();
      const propDesc = getJsDocText(propJsDocs).replace(/\n/g, " ").replace(/\|/g, "\\|");
      lines.push(`| \`${propName}${optional}\` | \`${propType.replace(/\|/g, "\\|")}\` | ${propDesc} |`);
    }
    lines.push("");
  }

  if (example) {
    lines.push("**Example:**");
    lines.push("");
    lines.push(example);
    lines.push("");
  }

  return lines.join("\n");
}

function generateTypeAlias(decl: TypeAliasDeclaration): string {
  const name = decl.getName();
  const jsDocs = decl.getJsDocs();
  const desc = getJsDocText(jsDocs);
  const typeText = formatType(decl.getType().getText(decl));

  const lines: string[] = [];
  lines.push(`### \`${name}\``);
  lines.push("");
  if (desc) {
    lines.push(desc);
    lines.push("");
  }
  lines.push("```ts");
  lines.push(`type ${name} = ${typeText}`);
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

function generateFunction(decl: FunctionDeclaration): string {
  const name = decl.getName() ?? "anonymous";
  const jsDocs = decl.getJsDocs();
  const desc = getJsDocText(jsDocs);
  const example = getJsDocExample(jsDocs);

  const params = decl.getParameters().map((p) => {
    const paramName = p.getName();
    const paramType = formatType(p.getType().getText(p));
    const optional = p.hasQuestionToken() || p.hasInitializer() ? "?" : "";
    return `${paramName}${optional}: ${paramType}`;
  });
  const returnType = formatType(decl.getReturnType().getText(decl));

  const lines: string[] = [];
  lines.push(`### \`${name}()\``);
  lines.push("");
  if (desc) {
    lines.push(desc);
    lines.push("");
  }
  lines.push("```ts");
  lines.push(`function ${name}(${params.join(", ")}): ${returnType}`);
  lines.push("```");
  lines.push("");

  if (example) {
    lines.push("**Example:**");
    lines.push("");
    lines.push(example);
    lines.push("");
  }

  return lines.join("\n");
}

function generateEnum(decl: EnumDeclaration): string {
  const name = decl.getName();
  const jsDocs = decl.getJsDocs();
  const desc = getJsDocText(jsDocs);

  const members = decl.getMembers().map((m) => {
    const memberName = m.getName();
    const memberValue = m.getValue();
    return `  ${memberName} = ${JSON.stringify(memberValue)}`;
  });

  const lines: string[] = [];
  lines.push(`### \`${name}\``);
  lines.push("");
  if (desc) {
    lines.push(desc);
    lines.push("");
  }
  lines.push("```ts");
  lines.push(`enum ${name} {`);
  lines.push(members.join(",\n"));
  lines.push("}");
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Process a single source file
// ---------------------------------------------------------------------------

function processSourceFile(sourceFile: SourceFile, subpath: string): string {
  const sections: string[] = [];
  sections.push(`## \`${subpath}\``);
  sections.push("");

  const exported = sourceFile.getExportedDeclarations();
  let count = 0;

  for (const [name, decls] of exported) {
    for (const decl of decls) {
      if (decl.getKind() === SyntaxKind.InterfaceDeclaration) {
        sections.push(generateInterface(decl as InterfaceDeclaration));
        count++;
      } else if (decl.getKind() === SyntaxKind.TypeAliasDeclaration) {
        sections.push(generateTypeAlias(decl as TypeAliasDeclaration));
        count++;
      } else if (decl.getKind() === SyntaxKind.FunctionDeclaration) {
        sections.push(generateFunction(decl as FunctionDeclaration));
        count++;
      } else if (decl.getKind() === SyntaxKind.EnumDeclaration) {
        sections.push(generateEnum(decl as EnumDeclaration));
        count++;
      }
      // Skip variable declarations, classes, etc. for now
    }
  }

  if (count === 0) {
    sections.push("*No documented exports.*");
    sections.push("");
  }

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const project = new Project({
    compilerOptions: {
      strict: true,
      target: 99, // ESNext
      module: 99, // ESNext
      moduleResolution: 100, // Bundler
      jsx: 4, // ReactJSX
      esModuleInterop: true,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
  });

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let allUpToDate = true;

  for (const sdk of SDKS) {
    const sections: string[] = [];

    // Frontmatter
    sections.push("---");
    sections.push(`title: "${sdk.title}"`);
    sections.push(`description: "${sdk.description}"`);
    sections.push("---");
    sections.push("");
    sections.push(`# ${sdk.title}`);
    sections.push("");
    sections.push(sdk.description);
    sections.push("");

    for (const mod of sdk.modules) {
      const filePath = join(ROOT, sdk.packageDir, mod.file);
      if (!existsSync(filePath)) {
        sections.push(`## \`${mod.subpath}\``);
        sections.push("");
        sections.push(`*Source file not found: ${mod.file}*`);
        sections.push("");
        continue;
      }

      const sourceFile = project.addSourceFileAtPath(filePath);
      sections.push(processSourceFile(sourceFile, mod.subpath));
    }

    const content = sections.join("\n").trim() + "\n";
    const outputPath = join(OUTPUT_DIR, sdk.outputFile);

    if (CHECK_MODE) {
      if (!existsSync(outputPath)) {
        console.error(`MISSING: ${sdk.outputFile}`);
        allUpToDate = false;
        continue;
      }
      const existing = readFileSync(outputPath, "utf-8");
      const existingHash = createHash("sha256").update(existing).digest("hex");
      const newHash = createHash("sha256").update(content).digest("hex");
      if (existingHash !== newHash) {
        console.error(`OUTDATED: ${sdk.outputFile}`);
        allUpToDate = false;
      } else {
        console.log(`OK: ${sdk.outputFile}`);
      }
    } else {
      writeFileSync(outputPath, content, "utf-8");
      console.log(`Generated: ${sdk.outputFile}`);
    }
  }

  if (CHECK_MODE && !allUpToDate) {
    console.error("\nSDK docs are out of date. Run `pnpm docs:sdk` to regenerate.");
    process.exit(1);
  }
}

main();
