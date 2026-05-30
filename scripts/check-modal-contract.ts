import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SOURCE_DIRS = [
  "apps/app/components",
  "packages/assistant-ui/src",
  "packages/plugin-sdk/src",
  "packages/widget-engine/src",
  "plugins",
  "widgets",
];

const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const EXCLUDED_FILE_PATTERN = /\.(test|spec|stories|story|scaffold)\.(ts|tsx)$/;
const SKIP_DIR_NAMES = new Set(["node_modules", ".turbo", "coverage", "dist", ".next"]);
const FORBIDDEN_LOW_LEVEL_IMPORTS = ['"@radarboard/ui/dialog"', '"@radix-ui/react-dialog"'];
const FORBIDDEN_DIALOG_CLASS_PATTERN =
  /\b(max-w|max-h|min-w|min-h|w-\[|h-\[|w-screen|h-screen|max-w-|max-h-|min-w-|min-h-)\b/;
const DESTRUCTIVE_APP_DIALOG_IMPORT_PATTERN =
  /import\s*\{[\s\S]*\bDialogDestructiveButton\b[\s\S]*\}\s*from\s*["']@radarboard\/ui\/app-dialog["'];?/m;
const DESTRUCTIVE_BUTTON_TAG_PATTERN = /<DialogDestructiveButton\b/;

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

function checkLowLevelImports(filePath: string, content: string): string[] {
  return FORBIDDEN_LOW_LEVEL_IMPORTS.filter((source) => content.includes(source)).map(
    (source) =>
      `${relative(ROOT, filePath)} imports ${source}. Product code must use "@radarboard/ui/app-dialog".`
  );
}

function checkDialogShellOverrides(filePath: string, content: string): string[] {
  const errors: string[] = [];
  const openTagPattern = /<DialogContent\b([\s\S]*?)>/g;
  let match: RegExpExecArray | null;

  while ((match = openTagPattern.exec(content)) !== null) {
    const tag = match[0];
    if (!tag.includes("className")) continue;
    if (!FORBIDDEN_DIALOG_CLASS_PATTERN.test(tag)) continue;

    errors.push(
      `${relative(ROOT, filePath)} overrides shared dialog shell sizing on <DialogContent>. Move size choice to the "size" prop and keep className for content layout only.`
    );
  }

  return errors;
}

function checkConfirmationDialogEnforcement(filePath: string, content: string): string[] {
  const relativePath = relative(ROOT, filePath);
  if (
    !DESTRUCTIVE_APP_DIALOG_IMPORT_PATTERN.test(content) &&
    !DESTRUCTIVE_BUTTON_TAG_PATTERN.test(content)
  ) {
    return [];
  }

  return [
    `${relativePath} uses DialogDestructiveButton directly. Confirmation and delete flows must use <ConfirmationDialog> from "@radarboard/ui/app-dialog" so S sizing and toast behavior stay enforced.`,
  ];
}

function main() {
  const files = SOURCE_DIRS.flatMap((dir) => collectSourceFiles(join(ROOT, dir)));
  const errors = files.flatMap((filePath) => {
    const content = readFileSync(filePath, "utf8");
    return [
      ...checkLowLevelImports(filePath, content),
      ...checkDialogShellOverrides(filePath, content),
      ...checkConfirmationDialogEnforcement(filePath, content),
    ];
  });

  if (errors.length === 0) {
    console.log("Modal contract check passed.");
    return;
  }

  console.error("Modal contract violations found:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

main();
