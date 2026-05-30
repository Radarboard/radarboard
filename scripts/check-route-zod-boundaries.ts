#!/usr/bin/env tsx

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Node,
  Project,
  SyntaxKind,
  type CallExpression,
  type FunctionLikeDeclaration,
  type Node as MorphNode,
  type ParameterDeclaration,
} from "ts-morph";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const BASELINE_PATH = path.join(REPO_ROOT, "scripts/route-zod-boundaries-baseline.txt");
const TARGET_ROOTS = ["apps/app/app/api", "apps/app/modules", "apps/marketing/app/api"] as const;

const REQUEST_METHOD_NAMES = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);
const QUERY_METHOD_NAMES = new Set(["get", "getAll", "has", "entries"]);
const NON_ZOD_PARSE_RECEIVERS = new Set(["JSON", "Date", "URL"]);

type BoundaryKind = "body" | "query" | "formData" | "urlEncoded";

export function shouldCheckFile(filePath: string): boolean {
  const normalizedPath = filePath.replaceAll(path.sep, "/");

  if (!/\.(?:[cm]?[jt]sx?)$/u.test(normalizedPath)) return false;
  if (
    normalizedPath.endsWith(".d.ts") ||
    normalizedPath.includes(".test.") ||
    normalizedPath.includes(".spec.") ||
    normalizedPath.includes(".stories.") ||
    normalizedPath.includes(".scaffold.")
  ) {
    return false;
  }

  if (normalizedPath.startsWith("apps/app/app/api/")) {
    return normalizedPath.endsWith("/route.ts");
  }

  if (normalizedPath.startsWith("apps/marketing/app/api/")) {
    return normalizedPath.endsWith("/route.ts");
  }

  if (normalizedPath.startsWith("apps/app/modules/")) {
    return normalizedPath.includes("/routes/") && normalizedPath.endsWith(".ts");
  }

  return false;
}

function walkCodeFiles(rootDir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".next-dev" ||
        entry.name === ".next-e2e" ||
        entry.name === ".turbo" ||
        entry.name === "dist"
      ) {
        continue;
      }

      files.push(...walkCodeFiles(absPath));
      continue;
    }

    const relPath = path.relative(REPO_ROOT, absPath).replaceAll(path.sep, "/");
    if (shouldCheckFile(relPath)) {
      files.push(relPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export function resolveTargetFiles(fileArgs: string[]): string[] {
  if (fileArgs.length === 0) {
    return TARGET_ROOTS.flatMap((root) => walkCodeFiles(path.join(REPO_ROOT, root)));
  }

  return Array.from(
    new Set(
      fileArgs
        .map((filePath) =>
          path.isAbsolute(filePath)
            ? path.relative(REPO_ROOT, filePath)
            : filePath
        )
        .map((filePath) => filePath.replaceAll(path.sep, "/"))
        .filter(shouldCheckFile)
    )
  ).sort((left, right) => left.localeCompare(right));
}

function isRouteHandlerName(name: string | undefined): boolean {
  return typeof name === "string" && REQUEST_METHOD_NAMES.has(name);
}

function getFunctionLikeName(node: FunctionLikeDeclaration): string | undefined {
  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
    return node.getName();
  }

  const parent = node.getParent();
  if (Node.isVariableDeclaration(parent)) {
    return parent.getName();
  }

  if (Node.isPropertyAssignment(parent)) {
    return parent.getName();
  }

  return undefined;
}

function isRequestParameter(parameter: ParameterDeclaration): boolean {
  const typeText = parameter.getTypeNode()?.getText() ?? "";
  const nameNode = parameter.getNameNode();

  if (Node.isIdentifier(nameNode) && ["request", "req"].includes(nameNode.getText())) {
    return true;
  }

  return typeText.includes("Request") || typeText.includes("NextRequest");
}

function getRequestNames(node: FunctionLikeDeclaration): Set<string> {
  const requestNames = new Set<string>();

  for (const parameter of node.getParameters()) {
    if (!isRequestParameter(parameter)) continue;
    const nameNode = parameter.getNameNode();
    if (Node.isIdentifier(nameNode)) {
      requestNames.add(nameNode.getText());
    }
  }

  return requestNames;
}

function isRouteLikeFunction(node: FunctionLikeDeclaration): boolean {
  if (getRequestNames(node).size > 0) return true;
  return isRouteHandlerName(getFunctionLikeName(node));
}

function getEnclosingRouteFunction(node: MorphNode): FunctionLikeDeclaration | undefined {
  return node.getFirstAncestor((ancestor) => Node.isFunctionLikeDeclaration(ancestor)) as
    | FunctionLikeDeclaration
    | undefined;
}

function isRequestJsonCall(node: CallExpression, requestNames: Set<string>): boolean {
  const expression = node.getExpression();
  return (
    Node.isPropertyAccessExpression(expression) &&
    expression.getName() === "json" &&
    Node.isIdentifier(expression.getExpression()) &&
    requestNames.has(expression.getExpression().getText())
  );
}

function isRequestMethodCall(
  node: CallExpression,
  requestNames: Set<string>,
  methodName: "formData" | "text"
): boolean {
  const expression = node.getExpression();
  return (
    Node.isPropertyAccessExpression(expression) &&
    expression.getName() === methodName &&
    Node.isIdentifier(expression.getExpression()) &&
    requestNames.has(expression.getExpression().getText())
  );
}

function isSearchParamsReceiver(node: MorphNode): boolean {
  if (Node.isIdentifier(node)) {
    return node.getText() === "searchParams";
  }

  if (!Node.isPropertyAccessExpression(node)) {
    return false;
  }

  return node.getName() === "searchParams";
}

function isSearchParamsReadCall(node: CallExpression): boolean {
  const expression = node.getExpression();
  return (
    Node.isPropertyAccessExpression(expression) &&
    QUERY_METHOD_NAMES.has(expression.getName()) &&
    isSearchParamsReceiver(expression.getExpression())
  );
}

function isSafeParseCall(node: CallExpression): boolean {
  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression) && expression.getName() === "safeParse";
}

function isLikelyZodParseCall(node: CallExpression): boolean {
  const expression = node.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "parse") {
    return false;
  }

  const receiverText = expression.getExpression().getText();
  return !NON_ZOD_PARSE_RECEIVERS.has(receiverText);
}

function isZodValidationCall(node: CallExpression): boolean {
  return isSafeParseCall(node) || isLikelyZodParseCall(node);
}

function hasValidationAncestor(node: MorphNode): boolean {
  return Boolean(
    node.getFirstAncestor(
      (ancestor) => Node.isCallExpression(ancestor) && isZodValidationCall(ancestor)
    )
  );
}

function getTrackedName(node: MorphNode): string | undefined {
  const variableDeclaration = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (variableDeclaration) {
    const nameNode = variableDeclaration.getNameNode();
    if (Node.isIdentifier(nameNode)) {
      return nameNode.getText();
    }
  }

  const assignment = node.getFirstAncestorByKind(SyntaxKind.BinaryExpression);
  if (!assignment || assignment.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return undefined;
  }

  const left = assignment.getLeft();
  return Node.isIdentifier(left) ? left.getText() : undefined;
}

function firstArgumentReferencesName(call: CallExpression, name: string): boolean {
  const [firstArg] = call.getArguments();
  if (!firstArg) return false;

  if (Node.isIdentifier(firstArg) && firstArg.getText() === name) {
    return true;
  }

  return firstArg
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => identifier.getText() === name);
}

function isNodeValidated(node: MorphNode, functionNode: FunctionLikeDeclaration): boolean {
  if (hasValidationAncestor(node)) {
    return true;
  }

  const variableName = getTrackedName(node);
  if (!variableName) {
    return false;
  }

  return functionNode
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(isZodValidationCall)
    .some((call) => firstArgumentReferencesName(call, variableName));
}

function formatViolation(filePath: string, line: number, kind: BoundaryKind): string {
  if (kind === "body") {
    return `${filePath}:${line} - request.json() result must be validated with Zod. Use parseBody(...) or schema.safeParse(...).`;
  }

  if (kind === "formData") {
    return `${filePath}:${line} - request.formData() must be validated with Zod. Use parseFormData(...).`;
  }

  if (kind === "urlEncoded") {
    return `${filePath}:${line} - URL-encoded request body must be validated with Zod. Use parseUrlEncodedBody(...).`;
  }

  return `${filePath}:${line} - Search params read without Zod validation. Use parseSearchParams(...) or schema.safeParse(...).`;
}

function isTrackedUrlSearchParamsUsage(
  functionNode: FunctionLikeDeclaration,
  trackedName: string
): boolean {
  return functionNode.getDescendantsOfKind(SyntaxKind.NewExpression).some((node) => {
    if (node.getExpression().getText() !== "URLSearchParams") return false;
    const [firstArg] = node.getArguments();
    return Boolean(firstArg && Node.isIdentifier(firstArg) && firstArg.getText() === trackedName);
  });
}

function collectFunctionViolations(
  filePath: string,
  functionNode: FunctionLikeDeclaration
): string[] {
  if (!isRouteLikeFunction(functionNode)) {
    return [];
  }

  const violations: string[] = [];
  const requestNames = getRequestNames(functionNode);
  const callExpressions = functionNode.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    if (requestNames.size > 0 && isRequestJsonCall(call, requestNames) && !isNodeValidated(call, functionNode)) {
      violations.push(formatViolation(filePath, call.getStartLineNumber(), "body"));
      continue;
    }

    if (requestNames.size > 0 && isRequestMethodCall(call, requestNames, "formData")) {
      violations.push(formatViolation(filePath, call.getStartLineNumber(), "formData"));
      continue;
    }

    if (requestNames.size > 0 && isRequestMethodCall(call, requestNames, "text")) {
      const trackedName = getTrackedName(call);
      if (trackedName && isTrackedUrlSearchParamsUsage(functionNode, trackedName)) {
        violations.push(formatViolation(filePath, call.getStartLineNumber(), "urlEncoded"));
      }
      continue;
    }

    if (isSearchParamsReadCall(call) && !isNodeValidated(call, functionNode)) {
      violations.push(formatViolation(filePath, call.getStartLineNumber(), "query"));
    }
  }

  return Array.from(new Set(violations));
}

export function collectViolationsFromSource(filePath: string, sourceText: string): string[] {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(filePath, sourceText);
  const violations: string[] = [];

  for (const functionNode of sourceFile.getDescendants()) {
    if (!Node.isFunctionLikeDeclaration(functionNode)) continue;
    if (getEnclosingRouteFunction(functionNode)) continue;
    violations.push(...collectFunctionViolations(filePath, functionNode));
  }

  return violations;
}

function collectViolationsForFile(filePath: string): string[] {
  const absolutePath = path.join(REPO_ROOT, filePath);
  const sourceText = readFileSync(absolutePath, "utf8");
  return collectViolationsFromSource(filePath, sourceText);
}

function readBaseline(): Set<string> {
  if (!existsSync(BASELINE_PATH)) {
    return new Set();
  }

  const source = readFileSync(BASELINE_PATH, "utf8").trim();
  if (!source) {
    return new Set();
  }

  return new Set(source.split("\n").filter(Boolean));
}

function writeBaseline(): void {
  const violations = resolveTargetFiles([])
    .flatMap(collectViolationsForFile)
    .sort((left, right) => left.localeCompare(right));

  writeFileSync(BASELINE_PATH, `${violations.join("\n")}\n`, "utf8");
  console.log(`Wrote ${violations.length} route Zod boundary baseline entries to ${BASELINE_PATH}`);
}

function main(): void {
  if (process.argv.includes("--write-baseline")) {
    writeBaseline();
    return;
  }

  const fileArgs = process.argv.slice(2);
  const targetFiles = resolveTargetFiles(fileArgs);
  const baseline = readBaseline();
  const allViolations = targetFiles.flatMap(collectViolationsForFile);
  const baselineViolations = allViolations.filter((violation) => baseline.has(violation));
  const newViolations = allViolations.filter((violation) => !baseline.has(violation));

  if (fileArgs.length === 0 && baselineViolations.length > 0) {
    console.log("\nWarning: existing route Zod boundary violations are grandfathered temporarily:\n");
    for (const violation of baselineViolations) {
      console.log(violation);
    }
    console.log(
      "\nThese warnings stay non-blocking until the baseline is cleared. New violations fail immediately."
    );
  }

  if (newViolations.length === 0) {
    console.log("✓ route handlers do not introduce new unvalidated request body or query reads");
    return;
  }

  console.error("\nNew route Zod boundary violations found:\n");
  for (const violation of newViolations) {
    console.error(violation);
  }
  console.error(
    "\nValidate request.json() with parseBody(...) or schema.safeParse(...), and validate search params with parseSearchParams(...) or schema.safeParse(...)."
  );
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
