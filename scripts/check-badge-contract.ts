import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SOURCE_PATHS = ["apps/app", "packages", "plugins", "widgets"];
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const EXCLUDED_FILE_PATTERN = /\.(test|spec|stories|story|scaffold)\.(ts|tsx)$/;
const SKIP_DIR_NAMES = new Set(["node_modules", ".turbo", "coverage", "dist", ".next", ".generated"]);
const ALLOWED_LOCAL_BADGE_FILES = new Set(["packages/ui/src/badge/index.tsx"]);
const LOCAL_BADGE_PATTERN = /\b(?:export\s+)?function\s+Badge\s*\(|\bconst\s+Badge\s*=/;

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

function main() {
  const files = SOURCE_PATHS.flatMap((entryPath) => collectSourceFiles(join(ROOT, entryPath)));
  const offenders = files.filter((filePath) => {
    const relativePath = relative(ROOT, filePath);
    if (ALLOWED_LOCAL_BADGE_FILES.has(relativePath)) return false;
    return LOCAL_BADGE_PATTERN.test(readFileSync(filePath, "utf8"));
  });

  if (offenders.length === 0) {
    console.log("Badge contract check passed.");
    return;
  }

  console.error("Badge contract violations found:\n");
  for (const filePath of offenders) {
    console.error(
      `- ${relative(ROOT, filePath)} defines a local Badge component. Use @radarboard/ui/badge instead.`
    );
  }
  process.exit(1);
}

main();
