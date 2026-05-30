import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SOURCE_PATHS = ["apps/app", "packages", "plugins", "widgets"];
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const EXCLUDED_FILE_PATTERN = /\.(test|spec|stories|story|scaffold)\.(ts|tsx)$/;
const SKIP_DIR_NAMES = new Set(["node_modules", ".turbo", "coverage", "dist", ".next", ".generated"]);
const SKIP_PATH_PREFIXES = ["apps/app/app/api/", "packages/ui/"];
const ALLOWED_RAW_BUTTON_FILES = new Set([
  "apps/app/modules/auth-shell/routes/mcp-oauth/authorize.ts",
  "apps/app/app/tray-panel/tray-panel-page-client.tsx",
  "apps/app/components/dashboard/dashboard/index.tsx",
  "apps/app/components/debug/sections/events-timeline/index.tsx",
  "apps/app/components/debug/sections/reports/index.tsx",
  "apps/app/components/notifications/notification-panel/index.tsx",
  "apps/app/components/plugins/plugin-launcher/index.tsx",
  "apps/app/components/plugins/plugin-overlay/index.tsx",
  "packages/assistant-ui/src/chat/chat-ui.tsx",
  "packages/plugin-sdk/src/components/sidebar/sidebar/folder-item.tsx",
  "packages/plugin-sdk/src/components/three-pane-drawer-adapter.tsx",
  "packages/plugin-sdk/src/components/three-pane-workspace.tsx",
  "packages/widget-engine/src/expanded-portal/index.tsx",
  "packages/widget-engine/src/templates/sections/list-section/index.tsx",
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

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function main() {
  const files = SOURCE_PATHS.flatMap((entryPath) => collectSourceFiles(join(ROOT, entryPath)));
  const offenders = files.filter((filePath) => {
    const relativePath = relative(ROOT, filePath);
    if (SKIP_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) return false;
    if (ALLOWED_RAW_BUTTON_FILES.has(relativePath)) return false;
    return /<button\b/.test(stripComments(readFileSync(filePath, "utf8")));
  });

  if (offenders.length === 0) {
    console.log("Button contract check passed.");
    return;
  }

  console.error("Button contract violations found:\n");
  for (const filePath of offenders) {
    console.error(
      `- ${relative(ROOT, filePath)} uses raw <button>. Use @radarboard/ui/button or a shared wrapper instead.`
    );
  }
  process.exit(1);
}

main();
