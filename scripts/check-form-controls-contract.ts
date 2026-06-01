import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SOURCE_PATHS = [
  "apps/app/components/settings",
  "packages/plugin-sdk/src",
  "plugins/notes/src/components/note-editor.tsx",
  "plugins/tasks/src/components/task-detail-panel.tsx",
  "plugins/expenses/src/components/expense-detail-panel.tsx",
  "plugins/changelog/src/components/changelog-overlay",
  "plugins/rss-reader/src/components/rss-reader-overlay.tsx",
  "plugins/embeddings/src/components/embeddings-overlay.tsx",
  "plugins/notes/src/components/template-manager.tsx",
  "plugins/tasks/src/components/task-kanban.tsx",
  "plugins/tasks/src/components/subtask-list.tsx",
  "plugins/expenses/src/components/tag-input.tsx",
  "plugins/expenses/src/components/budget-editor.tsx",
  "plugins/expenses/src/components/expense-list.tsx",
  "widgets/aso-keywords/src/components/aso-keywords-compact/index.tsx",
  "widgets/logs/src/components/log-filters/index.tsx",
  "packages/assistant-ui/src/chat/chat-composer.tsx",
  "packages/assistant-ui/src/chat/chat-search.tsx",
  "packages/widget-engine/src/widget-picker-popover/index.tsx",
  "packages/widget-engine/src/templates/sections/filter-bar-section/index.tsx",
  "packages/widget-engine/src/templates/sections/stream-list-section/index.tsx",
  "packages/widget-engine/src/templates/sections/card-list-section/index.tsx",
];
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const EXCLUDED_FILE_PATTERN = /\.(stories|story|scaffold)\.(ts|tsx)$/;
const SKIP_DIR_NAMES = new Set(["node_modules", ".turbo", "coverage", "dist", ".next"]);

const LABEL_EXCEPTION_FILES = new Set([
  "apps/app/components/settings/settings-integrations/components/service-card.tsx",
  "apps/app/components/settings/settings-projects/project-detail-panel.tsx",
  "apps/app/components/settings/settings-projects/project-list-panel.tsx",
  "packages/assistant-ui/src/chat/chat-composer.tsx",
]);

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (!SOURCE_FILE_PATTERN.test(entry.name) || EXCLUDED_FILE_PATTERN.test(entry.name)) continue;
    files.push(fullPath);
  }

  return files;
}

function isAllowedRawInput(tag: string): boolean {
  return /type\s*=\s*["'](?:checkbox|color|file|hidden)["']/i.test(tag);
}

function checkFile(filePath: string, content: string): string[] {
  const errors: string[] = [];
  const relativePath = relative(ROOT, filePath);
  const tagPattern = /<(input|textarea|select|label)\b([\s\S]*?)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(content)) !== null) {
    const tagName = match[1];
    const tag = match[0];

    if (tagName === "input" && isAllowedRawInput(tag)) {
      continue;
    }

    if (tagName === "label" && LABEL_EXCEPTION_FILES.has(relativePath)) {
      continue;
    }

    errors.push(
      `${relativePath} uses raw <${tagName}>. Use shared form controls from @radarboard/ui instead, or add a justified exception.`
    );
  }

  return errors;
}

function main() {
  const files = SOURCE_PATHS.flatMap((entryPath) => {
    const absolutePath = join(ROOT, entryPath);
    if (!existsSync(absolutePath)) return [];
    const stat = statSync(absolutePath);
    return stat.isDirectory() ? collectSourceFiles(absolutePath) : [absolutePath];
  });
  const errors = files.flatMap((filePath) => checkFile(filePath, readFileSync(filePath, "utf8")));

  if (errors.length === 0) {
    console.log("Form controls contract check passed.");
    return;
  }

  console.error("Form controls contract violations found:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

main();
