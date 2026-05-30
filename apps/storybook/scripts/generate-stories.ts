/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: generator intentionally handles multiple roots and proxy rewrites. */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../..");
const generatedStoriesRoot = path.join(repoRoot, "apps/storybook/.generated");
const componentFilePattern = /\.tsx$/;
const excludedFilePattern = /\.(stories|test|spec)\.tsx$/;
const exportedComponentPattern =
  /^\s*export\s+(?:function|const|let|var|class)\s+([A-Z][A-Za-z0-9]*)\b/gm;
const scaffoldImportPath = "@radarboard/storybook-scaffold";

const skippedExportsByFile = new Map<string, Set<string>>([
  ["packages/ui/src/card/index.tsx", new Set(["CardHeader", "CardTitle", "CardContent"])],
  [
    "packages/ui/src/dialog/index.tsx",
    new Set([
      "DialogTrigger",
      "DialogClose",
      "DialogOverlay",
      "DialogContent",
      "DialogHeader",
      "DialogTitle",
      "DialogDescription",
      "DialogBody",
      "DialogFooter",
      "DialogCancelButton",
      "DialogDestructiveButton",
      "DetailRow",
      "DetailLink",
    ]),
  ],
  ["packages/ui/src/tabs/index.tsx", new Set(["TabsList", "TabsTrigger", "TabsContent"])],
  [
    "packages/ui/src/tooltip/index.tsx",
    new Set(["TooltipProvider", "TooltipTrigger", "TooltipContent"]),
  ],
  ["packages/ui/src/toggle-group/index.tsx", new Set(["ToggleGroupItem"])],
  [
    "packages/widget-engine/src/components/inline-list-layout.tsx",
    new Set(["InlineListHeader", "InlineListRow"]),
  ],
  [
    "packages/widget-engine/src/layout-recipe-gallery/index.tsx",
    new Set(["LayoutRecipeGallery", "LayoutRecipeGrid"]),
  ],
]);

type StoryRoot = {
  root: string;
  titlePrefix: string;
  sourcePrefix: string;
  storyNamespace: string;
};

const staticStoryRoots: StoryRoot[] = [
  {
    root: path.join(repoRoot, "apps/app/components"),
    titlePrefix: "Components",
    sourcePrefix: "apps/app/components",
    storyNamespace: "web-components",
  },
  {
    root: path.join(repoRoot, "packages/ui/src"),
    titlePrefix: "UI",
    sourcePrefix: "packages/ui/src",
    storyNamespace: "ui",
  },
  {
    root: path.join(repoRoot, "packages/widget-engine/src"),
    titlePrefix: "Widget Engine",
    sourcePrefix: "packages/widget-engine/src",
    storyNamespace: "widget-engine",
  },
];

const widgetRoots: StoryRoot[] = fs
  .readdirSync(path.join(repoRoot, "widgets"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => ({
    root: path.join(repoRoot, "widgets", d.name, "src"),
    titlePrefix: "Widgets",
    sourcePrefix: `widgets/${d.name}/src`,
    storyNamespace: `widgets-${d.name}`,
  }))
  .filter((r) => fs.existsSync(r.root));

const storyRoots: StoryRoot[] = [...staticStoryRoots, ...widgetRoots];

const watchMode = process.argv.includes("--watch");
let regenerateTimer: NodeJS.Timeout | null = null;
const watchStartupQuietPeriodMs = 2_000;

function writeFileIfChanged(filePath: string, nextSource: string): boolean {
  if (fs.existsSync(filePath)) {
    const existingSource = fs.readFileSync(filePath, "utf8");
    if (existingSource === nextSource) {
      return false;
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, nextSource);
  return true;
}

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(fullPath);
    }

    return [fullPath];
  });
}

function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function segmentToKebab(segment: string): string {
  return segment.toLowerCase().replace(/\s+/g, "-");
}

function toTitle(root: StoryRoot, componentPath: string, exportName: string): string {
  const relativePath = path.relative(root.root, componentPath);
  const folderSegments = path
    .dirname(relativePath)
    .split(path.sep)
    .filter((segment) => segment !== ".");
  const titleSegments = folderSegments.map((segment) =>
    segment
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );

  const filtered = titleSegments.filter((segment) => {
    if (segment.toLowerCase() === root.titlePrefix.toLowerCase()) return false;
    if (segment.toLowerCase() === "components") return false;
    if (segmentToKebab(segment) === toKebabCase(exportName)) return false;
    return true;
  });

  return [root.titlePrefix, ...filtered, exportName].join("/");
}

function getExportedComponents(source: string): string[] {
  const matches = Array.from(source.matchAll(exportedComponentPattern))
    .map((match) => match[1])
    .filter((name): name is string => Boolean(name));

  return [...new Set(matches)];
}

function createStorySource(
  root: StoryRoot,
  componentPath: string,
  exportName: string,
  storyPath: string
): string {
  const importTarget = getImportTarget(componentPath, storyPath);
  const relativePath = path
    .join(root.sourcePrefix, path.relative(root.root, componentPath))
    .replaceAll(path.sep, "/");
  const title = toTitle(root, componentPath, exportName);

  return `/* biome-ignore-all assist/source/organizeImports: generated Storybook scaffold. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: story files import Storybook packages from the dedicated apps/storybook workspace. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and generated identifiers follow Storybook conventions. */
import type { Meta } from "@storybook/nextjs-vite";
import { ${exportName} } from "${importTarget}";
import { renderScaffoldStory } from "${scaffoldImportPath}";

const meta = {
  title: "${title}",
  component: ${exportName},
} satisfies Meta<typeof ${exportName}>;

export default meta;

export const Default = {
  render: () =>
    renderScaffoldStory({
      componentName: "${exportName}",
      sourcePath: "${relativePath}",
      Component: ${exportName},
      args: {},
    }),
};
`;
}

function getStoryDir(root: StoryRoot, componentPath: string): string {
  if (root.storyNamespace === "web-components") {
    return path.join(path.dirname(componentPath), "__stories__");
  }

  return path.dirname(componentPath);
}

function getImportTarget(componentPath: string, storyPath: string): string {
  const componentModulePath = componentPath.slice(0, -path.extname(componentPath).length);
  let importTarget = path
    .relative(path.dirname(storyPath), componentModulePath)
    .replaceAll(path.sep, "/");

  if (!importTarget.startsWith(".")) {
    importTarget = `./${importTarget}`;
  }

  return importTarget;
}

function rewriteRelativeSpecifiers(source: string, fromFile: string, toFile: string): string {
  let previewSpecifier = path
    .relative(path.dirname(toFile), path.join(repoRoot, "apps/storybook/.storybook/preview"))
    .replaceAll(path.sep, "/");

  if (!previewSpecifier.startsWith(".")) {
    previewSpecifier = `./${previewSpecifier}`;
  }

  const withPreviewAliasPlaceholder = source.replaceAll(
    /from\s+["']@radarboard\/storybook-preview["']/g,
    'from "__STORYBOOK_PREVIEW__"'
  );

  return withPreviewAliasPlaceholder
    .replaceAll(/(from\s+["'])(\.[^"']*)(["'])/g, (_, prefix, specifier, suffix) => {
      const resolvedTarget = path.resolve(path.dirname(fromFile), specifier);
      let rewrittenSpecifier = path
        .relative(path.dirname(toFile), resolvedTarget)
        .replaceAll(path.sep, "/");

      if (!rewrittenSpecifier.startsWith(".")) {
        rewrittenSpecifier = `./${rewrittenSpecifier}`;
      }

      return `${prefix}${rewrittenSpecifier}${suffix}`;
    })
    .replaceAll('"__STORYBOOK_PREVIEW__"', `"${previewSpecifier}"`);
}

function shouldProxyStorySource(source: string): boolean {
  return !source.includes("renderScaffoldStory");
}

function generateStories() {
  fs.mkdirSync(generatedStoriesRoot, { recursive: true });

  let createdCount = 0;
  let skippedCount = 0;
  let proxyCount = 0;
  const expectedProxyPaths = new Set<string>();

  for (const root of storyRoots) {
    const files = walk(root.root)
      .filter((file) => componentFilePattern.test(file))
      .filter((file) => !excludedFilePattern.test(file));

    for (const filePath of files) {
      const source = fs.readFileSync(filePath, "utf8");
      const relativeFilePath = path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
      const skippedExports = skippedExportsByFile.get(relativeFilePath) ?? new Set<string>();
      const exports = getExportedComponents(source).filter(
        (exportName) => !skippedExports.has(exportName)
      );

      for (const exportName of exports) {
        const kebabName = toKebabCase(exportName);
        const storyDir = getStoryDir(root, filePath);
        const scaffoldPath = path.join(storyDir, `${kebabName}.scaffold.stories.tsx`);
        const handWrittenPath = path.join(storyDir, `${kebabName}.stories.tsx`);
        const nextSource = createStorySource(root, filePath, exportName, scaffoldPath);

        if (fs.existsSync(handWrittenPath)) {
          const existingSource = fs.readFileSync(handWrittenPath, "utf8");
          if (existingSource.includes("renderScaffoldStory")) {
            if (writeFileIfChanged(handWrittenPath, nextSource)) {
              createdCount += 1;
            }
          } else {
            skippedCount += 1;
          }
          continue;
        }

        if (fs.existsSync(scaffoldPath)) {
          const existingSource = fs.readFileSync(scaffoldPath, "utf8");
          if (existingSource.includes("renderScaffoldStory")) {
            if (writeFileIfChanged(scaffoldPath, nextSource)) {
              createdCount += 1;
            }
          } else {
            skippedCount += 1;
          }
          continue;
        }

        if (writeFileIfChanged(scaffoldPath, nextSource)) {
          createdCount += 1;
        }
      }
    }
  }

  for (const root of storyRoots) {
    const storyFiles = walk(root.root).filter((file) => file.endsWith(".stories.tsx"));

    for (const storyFile of storyFiles) {
      const storySource = fs.readFileSync(storyFile, "utf8");
      if (!shouldProxyStorySource(storySource)) {
        continue;
      }

      const flattenedStoryName = path
        .relative(root.root, storyFile)
        .replaceAll(path.sep, "__")
        .replace(/\.tsx$/, ".proxy.stories.tsx");

      const proxyPath = path.join(generatedStoriesRoot, root.storyNamespace, flattenedStoryName);
      expectedProxyPaths.add(proxyPath);

      const proxySource = rewriteRelativeSpecifiers(storySource, storyFile, proxyPath);
      if (writeFileIfChanged(proxyPath, proxySource)) {
        proxyCount += 1;
      }
    }
  }

  const existingProxyPaths = walk(generatedStoriesRoot).filter((file) =>
    file.endsWith(".stories.proxy.stories.tsx")
  );

  for (const existingProxyPath of existingProxyPaths) {
    if (!expectedProxyPaths.has(existingProxyPath)) {
      fs.rmSync(existingProxyPath, { force: true });
    }
  }

  console.log(
    JSON.stringify(
      {
        createdCount,
        skippedCount,
        proxyCount,
      },
      null,
      2
    )
  );
}

function scheduleGenerate() {
  if (regenerateTimer) {
    clearTimeout(regenerateTimer);
  }

  regenerateTimer = setTimeout(() => {
    regenerateTimer = null;
    try {
      generateStories();
    } catch (error) {
      console.error("[storybook] failed to regenerate stories", error);
    }
  }, 120);
}

function watchStories() {
  generateStories();
  const watchStartedAt = Date.now();

  const watchers = storyRoots.map((root) =>
    fs.watch(root.root, { recursive: true }, (_eventType, fileName) => {
      if (!fileName) return;
      if (!/\.(tsx|ts)$/.test(fileName)) return;
      if (Date.now() - watchStartedAt < watchStartupQuietPeriodMs) return;
      scheduleGenerate();
    })
  );

  console.log("[storybook] watching story roots for changes");

  const close = () => {
    for (const watcher of watchers) watcher.close();
    process.exit(0);
  };

  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

if (watchMode) {
  watchStories();
} else {
  generateStories();
}
