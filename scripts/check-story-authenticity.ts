import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const storyFilePattern = /\.stories\.tsx$/;
const generatedStoryPattern = /\.scaffold\.stories\.tsx$/;
const topLevelWrapperPattern =
  /render\s*:\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*(?:\(\s*)?<\s*(div|section|main|article)\b/gs;
const screenTitlePattern = /title\s*:\s*["'`]Screens\//;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

function collectTargetStoryFiles(explicitFiles: string[]): string[] {
  if (explicitFiles.length > 0) {
    return explicitFiles
      .map((file) => path.resolve(process.cwd(), file))
      .filter((file) => storyFilePattern.test(file) && !generatedStoryPattern.test(file));
  }

  const appStories = walk(path.join(repoRoot, "apps/app/components")).filter((file) => {
    return file.includes("/__stories__/") && storyFilePattern.test(file) && !generatedStoryPattern.test(file);
  });

  const allStories = [
    ...walk(path.join(repoRoot, "apps")),
    ...walk(path.join(repoRoot, "packages")),
    ...walk(path.join(repoRoot, "widgets")),
  ].filter((file) => storyFilePattern.test(file) && !generatedStoryPattern.test(file));

  const screenStories = allStories.filter((file) => {
    const source = fs.readFileSync(file, "utf8");
    return screenTitlePattern.test(source);
  });

  return [...new Set([...appStories, ...screenStories])];
}

function hasTopLevelStoryWrapper(source: string): boolean {
  return topLevelWrapperPattern.test(source);
}

function main() {
  const files = collectTargetStoryFiles(process.argv.slice(2));
  const failures: string[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    if (hasTopLevelStoryWrapper(source)) {
      failures.push(
        `${path.relative(repoRoot, file)}: top-level story wrappers are forbidden; render the real component or move layout into the real component/provider layer`
      );
    }
  }

  if (failures.length > 0) {
    console.error("Story authenticity check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Story authenticity check passed (${files.length} files checked).`);
}

main();
