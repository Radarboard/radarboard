import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SOURCE_PATHS = ["apps/app", "packages", "plugins", "widgets"];
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const EXCLUDED_FILE_PATTERN = /\.(test|spec|stories|story|scaffold)\.(ts|tsx)$/;
const SKIP_DIR_NAMES = new Set(["node_modules", ".turbo", "coverage", "dist", ".next", ".generated"]);
const DIRECT_INTERACTIVE_COMPONENTS = new Set([
  "button",
  "Button",
  "SelectTrigger",
  "ToggleGroup",
  "ToggleGroupItem",
  "TabsTrigger",
]);
const NATIVE_INTERACTIVE_ATTRS = new Set([
  "onClick",
  "onDoubleClick",
  "onMouseDown",
  "onPointerDown",
  "onTouchStart",
  "href",
  "tabIndex",
]);

type Offender = {
  path: string;
  line: number;
  tagName: string;
};

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

function getTagName(node: ts.JsxOpeningLikeElement): string {
  return node.tagName.getText();
}

function getAttribute(
  attributes: ts.JsxAttributes,
  name: string
): ts.JsxAttribute | undefined {
  return attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.text === name
  );
}

function hasAttribute(attributes: ts.JsxAttributes, name: string): boolean {
  return Boolean(getAttribute(attributes, name));
}

function getStringAttributeValue(attribute: ts.JsxAttribute | undefined): string | null {
  if (!attribute?.initializer) return null;

  if (ts.isStringLiteral(attribute.initializer)) {
    return attribute.initializer.text;
  }

  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression &&
    ts.isStringLiteral(attribute.initializer.expression)
  ) {
    return attribute.initializer.expression.text;
  }

  return null;
}

function isInteractiveNativeElement(tagName: string, attributes: ts.JsxAttributes): boolean {
  if (tagName !== tagName.toLowerCase()) return false;

  if (Array.from(NATIVE_INTERACTIVE_ATTRS).some((name) => hasAttribute(attributes, name))) {
    return true;
  }

  const role = getStringAttributeValue(getAttribute(attributes, "role"));
  return role === "button";
}

function isInteractiveComponent(tagName: string, attributes: ts.JsxAttributes): boolean {
  if (DIRECT_INTERACTIVE_COMPONENTS.has(tagName)) return true;
  if (tagName.endsWith("Button")) return true;
  return isInteractiveNativeElement(tagName, attributes);
}

function findOffenders(filePath: string): Offender[] {
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const offenders: Offender[] = [];
  const relativePath = relative(ROOT, filePath);

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = getTagName(node);
      const attributes = node.attributes;

      if (hasAttribute(attributes, "title") && isInteractiveComponent(tagName, attributes)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        offenders.push({
          path: relativePath,
          line: line + 1,
          tagName,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return offenders;
}

function main() {
  const files = SOURCE_PATHS.flatMap((entryPath) => collectSourceFiles(join(ROOT, entryPath)));
  const offenders = files.flatMap((filePath) => findOffenders(filePath));

  if (offenders.length === 0) {
    console.log("Tooltip contract check passed.");
    return;
  }

  console.error("Tooltip contract violations found:\n");
  for (const offender of offenders) {
    console.error(
      `- ${offender.path}:${offender.line} uses native title on interactive ${offender.tagName}. Use @radarboard/ui/tooltip or a tooltip-backed wrapper instead.`
    );
  }
  process.exit(1);
}

main();
