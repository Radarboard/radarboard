import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Counts biome-ignore comments across the codebase and compares to a baseline.
 * If the count increases in a commit, warns. Prevents suppression proliferation.
 */

const BASELINE_PATH = path.join(process.cwd(), "scripts/biome-ignore-baseline.txt");

function countIgnores(): number {
  try {
    const output = execSync(
      'grep -rn "biome-ignore" --include="*.ts" --include="*.tsx" apps/ packages/ 2>/dev/null | wc -l',
      { encoding: "utf8" }
    ).trim();
    return Number.parseInt(output, 10) || 0;
  } catch {
    return 0;
  }
}

function readBaseline(): number {
  if (!fs.existsSync(BASELINE_PATH)) return 0;
  const content = fs.readFileSync(BASELINE_PATH, "utf8").trim();
  return Number.parseInt(content, 10) || 0;
}

function writeBaseline(count: number) {
  fs.writeFileSync(BASELINE_PATH, `${count}\n`);
  console.log(`Wrote biome-ignore baseline: ${count}`);
}

function main() {
  if (process.argv.includes("--write-baseline")) {
    writeBaseline(countIgnores());
    return;
  }

  const currentCount = countIgnores();
  const baselineCount = readBaseline();

  if (baselineCount === 0) {
    console.warn(`No biome-ignore baseline found. Run: pnpm tsx scripts/audit-biome-ignores.ts --write-baseline`);
    return;
  }

  if (currentCount > baselineCount) {
    console.error(
      `biome-ignore count increased: ${baselineCount} -> ${currentCount} (+${currentCount - baselineCount})`
    );
    console.error("Avoid adding new biome-ignore comments. Fix the underlying issue instead.");
    process.exit(1);
  }

  if (currentCount < baselineCount) {
    console.log(
      `biome-ignore count decreased: ${baselineCount} -> ${currentCount} (-${baselineCount - currentCount}). Consider updating the baseline.`
    );
  }
}

main();
