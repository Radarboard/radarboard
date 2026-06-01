import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Enforces visual and UX consistency across Radarboard UI surfaces.
 *
 * Rules:
 * 1. No local Card/CardHeader/CardContent components — use @radarboard/ui/card
 * 2. No local EmptyState components — use @radarboard/ui/empty-state
 * 3. No local Skeleton/Shimmer components — use @radarboard/ui/skeleton-shimmer
 * 4. No direct Radix imports — use @radarboard/ui wrappers
 * 5. Plugins must use @radarboard/plugin-sdk/components for list/detail patterns
 * 6. No local toast/notification implementations — use api.notify()
 * 7. No readable UI text below the app's 12px minimum token floor
 */

const ROOT = process.cwd();
const UI_SOURCE_PATHS = [
  "apps/app/components",
  "packages/assistant-ui/src",
  "packages/plugin-sdk/src",
  "packages/ui/src",
  "packages/widget-engine/src",
  "plugins",
  "widgets",
];
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const EXCLUDED_FILE_PATTERN = /\.(test|spec|stories|story|scaffold)\.(ts|tsx)$/;
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".turbo",
  "coverage",
  "dist",
  ".next",
  ".generated",
  "_template",
]);

/**
 * Per-rule allowlist for known exceptions.
 * Key = rule id, value = set of relative file paths that are allowed to violate.
 * Add entries here when a widget/plugin legitimately needs a component not yet in @radarboard/ui.
 */
const RULE_ALLOWLIST: Record<string, Set<string>> = {
  "no-direct-radix": new Set([
    // Uses @radix-ui/react-slider — no @radarboard/ui/slider wrapper yet
    "widgets/aso-keywords/src/components/aso-keywords-expanded/index.tsx",
  ]),
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

interface Rule {
  id: string;
  description: string;
  /** Only apply to these UI source categories. Omit = all. */
  scope?: UiSourceCategory[];
  check: (content: string, relativePath: string) => string | null;
}

type UiSourceCategory =
  | "app"
  | "assistant-ui"
  | "plugin-sdk"
  | "ui"
  | "widget-engine"
  | "plugins"
  | "widgets";

const SMALL_TEXT_PATTERN = /\b(?:file:)?text-(?:xs|sm)\b/;
const ARBITRARY_TEXT_SIZE_PATTERN = /\btext-\[(?:\d+(?:\.\d+)?(?:px|rem|em)|calc\(|clamp\()/;
const LOW_OPACITY_TEXT_PATTERN =
  /\b(?:placeholder:)?text-(?:dim|muted-foreground|foreground-secondary)\/(?:[0-6][0-9]|[0-9])\b|\btext-\[var\(--color-text-muted\)\]\/(?:[0-6][0-9]|[0-9])\b/;

const RULES: Rule[] = [
  {
    id: "no-local-card",
    description: "Use @radarboard/ui/card instead of defining local Card components",
    scope: ["plugins", "widgets"],
    check: (content) => {
      const pattern =
        /\b(?:export\s+)?(?:function|const)\s+(?:Card|CardHeader|CardContent|CardFooter)\s*[=(]/;
      return pattern.test(content)
        ? "Defines a local Card component. Import from @radarboard/ui/card instead."
        : null;
    },
  },
  {
    id: "no-local-empty-state",
    description: "Use @radarboard/ui/empty-state instead of local empty components",
    scope: ["plugins", "widgets"],
    check: (content) => {
      const pattern = /\b(?:export\s+)?(?:function|const)\s+EmptyState\s*[=(]/;
      return pattern.test(content)
        ? "Defines a local EmptyState component. Import from @radarboard/ui/empty-state instead."
        : null;
    },
  },
  {
    id: "no-local-skeleton",
    description: "Use @radarboard/ui/skeleton-shimmer instead of local skeleton components",
    scope: ["plugins", "widgets"],
    check: (content) => {
      const pattern =
        /\b(?:export\s+)?(?:function|const)\s+(?:Skeleton|SkeletonShimmer|ShimmerBlock)\s*[=(]/;
      return pattern.test(content)
        ? "Defines a local Skeleton component. Import from @radarboard/ui/skeleton-shimmer instead."
        : null;
    },
  },
  {
    id: "no-direct-radix",
    description: "Use @radarboard/ui wrappers instead of direct Radix imports",
    scope: ["plugins", "widgets"],
    check: (content, relativePath) => {
      // Skip plugin-sdk itself — it wraps Radix for plugin components
      if (relativePath.startsWith("packages/")) return null;
      const pattern = /from\s+["']@radix-ui\//;
      return pattern.test(content)
        ? "Imports directly from @radix-ui. Use the @radarboard/ui wrapper instead."
        : null;
    },
  },
  {
    id: "no-local-toast",
    description: "Plugins must use api.notify() instead of local toast implementations",
    scope: ["plugins"],
    check: (content) => {
      const importPattern = /from\s+["'](?:react-hot-toast|sonner|react-toastify)/;
      const localPattern = /\b(?:export\s+)?(?:function|const)\s+(?:Toast|Toaster)\s*[=(]/;
      if (importPattern.test(content)) {
        return "Imports a third-party toast library. Use api.notify() from PluginAPI instead.";
      }
      if (localPattern.test(content)) {
        return "Defines a local Toast component. Use api.notify() from PluginAPI instead.";
      }
      return null;
    },
  },
  {
    id: "no-local-scroll-area",
    description:
      "Use @radarboard/ui/scroll-area instead of local scroll containers",
    scope: ["plugins", "widgets"],
    check: (content) => {
      const pattern = /\b(?:export\s+)?(?:function|const)\s+ScrollArea\s*[=(]/;
      return pattern.test(content)
        ? "Defines a local ScrollArea component. Import from @radarboard/ui/scroll-area instead."
        : null;
    },
  },
  {
    id: "plugin-uses-sdk-components",
    description:
      "Plugins should use @radarboard/plugin-sdk/components for list and detail patterns",
    scope: ["plugins"],
    check: (content, relativePath) => {
      // Only check plugin overlay/component files, not tests or types
      if (!relativePath.endsWith(".tsx")) return null;
      if (/types\.ts$/.test(relativePath)) return null;

      // If the plugin builds a custom list with 5+ raw list items, suggest SDK components
      const rawListPattern = /<(?:li|div)\s[^>]*(?:key=)/g;
      const matches = content.match(rawListPattern);
      if (matches && matches.length >= 5) {
        const usesListRow = /from\s+["']@radarboard\/plugin-sdk\/components\/list-row/.test(
          content
        );
        if (!usesListRow) {
          return "Has 5+ keyed list items. Consider using @radarboard/plugin-sdk/components/list-row for consistent styling.";
        }
      }
      return null;
    },
  },
  {
    id: "readable-text-floor",
    description: "Use text-w-* tokens for visible readable text; minimum rendered size is 12px",
    check: (content) => {
      if (SMALL_TEXT_PATTERN.test(content)) {
        return "Uses text-xs/text-sm. Use semantic text-w-* tokens so readable text respects the 12px floor.";
      }
      if (ARBITRARY_TEXT_SIZE_PATTERN.test(content)) {
        return "Uses an arbitrary text size. Use the app text-w-* scale instead.";
      }
      if (LOW_OPACITY_TEXT_PATTERN.test(content)) {
        return "Uses low-opacity semantic text. Use a readable semantic color token instead.";
      }
      return null;
    },
  },
];

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function collectSourceFiles(dir: string): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (
      !SOURCE_FILE_PATTERN.test(entry.name) ||
      EXCLUDED_FILE_PATTERN.test(entry.name)
    ) {
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface Violation {
  file: string;
  ruleId: string;
  message: string;
}

function main() {
  const files = UI_SOURCE_PATHS.flatMap((entryPath) =>
    collectSourceFiles(join(ROOT, entryPath))
  );

  const violations: Violation[] = [];

  for (const filePath of files) {
    const relativePath = relative(ROOT, filePath);
    const category = getUiSourceCategory(relativePath);

    if (!category) continue;

    const content = readFileSync(filePath, "utf8");

    for (const rule of RULES) {
      if (rule.scope && !rule.scope.includes(category)) {
        continue;
      }

      const allowlist = RULE_ALLOWLIST[rule.id];
      if (allowlist?.has(relativePath)) continue;

      const message = rule.check(content, relativePath);
      if (message) {
        violations.push({ file: relativePath, ruleId: rule.id, message });
      }
    }
  }

  if (violations.length === 0) {
    console.log("UI consistency check passed.");
    return;
  }

  console.error(
    `UI consistency violations found (${violations.length}):\n`
  );
  for (const { file, ruleId, message } of violations) {
    console.error(`  ${file} [${ruleId}]: ${message}`);
  }
  console.error(
    "\nRadarboard UI surfaces must use shared components, readable tokens, and semantic styling."
  );
  console.error(
    "See: @radarboard/ui, @radarboard/plugin-sdk/components"
  );
  process.exit(1);
}

function getUiSourceCategory(relativePath: string): UiSourceCategory | null {
  if (relativePath.startsWith("apps/app/components/")) return "app";
  if (relativePath.startsWith("packages/assistant-ui/src/")) return "assistant-ui";
  if (relativePath.startsWith("packages/plugin-sdk/src/")) return "plugin-sdk";
  if (relativePath.startsWith("packages/ui/src/")) return "ui";
  if (relativePath.startsWith("packages/widget-engine/src/")) return "widget-engine";
  if (relativePath.startsWith("plugins/")) return "plugins";
  if (relativePath.startsWith("widgets/")) return "widgets";
  return null;
}

main();
