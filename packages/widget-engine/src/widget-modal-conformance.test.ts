import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ALLOWED_DIALOG_CONTENT_IMPORTS = new Set([
  "widget-modal.tsx",
  "widget-modal/index.tsx",
  "widget-slot.tsx",
  "widget-slot/index.tsx",
]);

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry) || /\.(test|stories)\./.test(entry)) continue;
    files.push(fullPath);
  }

  return files;
}

describe("widget modal conformance", () => {
  it("keeps DialogContent imports confined to the shared widget modal layer", () => {
    const sourceFiles = collectSourceFiles(__dirname);
    const offenders = sourceFiles
      .filter((file) =>
        /import\s*\{[\s\S]*\bDialogContent\b[\s\S]*\}\s*from\s*"@radarboard\/ui\/dialog"/m.test(
          readFileSync(file, "utf8")
        )
      )
      .map((file) => relative(__dirname, file))
      .filter((file) => !ALLOWED_DIALOG_CONTENT_IMPORTS.has(file));

    expect(offenders).toEqual([]);
  });
});
