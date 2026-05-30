import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertApiRouteLoads,
  assertRequiredPackages,
  getMissingPackages,
  REQUIRED_PACKAGES,
  verifyStandaloneBundle,
} from "./verify-sidecar-bundle.mjs";

function createStandaloneRoot() {
  const root = mkdtempSync(join(tmpdir(), "radarboard-standalone-"));
  mkdirSync(join(root, "node_modules"), { recursive: true });
  mkdirSync(join(root, "apps", "app", ".next", "server", "app", "api", "[...path]"), {
    recursive: true,
  });
  return root;
}

function addRequiredPackages(root) {
  for (const pkg of REQUIRED_PACKAGES) {
    const pkgDir = join(root, "node_modules", pkg);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: pkg }), "utf8");
  }
}

function writeRouteEntry(root, source) {
  const routeEntry = join(
    root,
    "apps",
    "app",
    ".next",
    "server",
    "app",
    "api",
    "[...path]",
    "route.js"
  );
  writeFileSync(routeEntry, source, "utf8");
}

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("verify-sidecar-bundle", () => {
  it("reports missing top-level runtime packages", () => {
    const root = createStandaloneRoot();
    tempRoots.push(root);

    addRequiredPackages(root);
    rmSync(join(root, "node_modules", "fetch-blob"), { recursive: true, force: true });

    expect(getMissingPackages(root)).toEqual(["fetch-blob"]);
    expect(() => assertRequiredPackages(root)).toThrow(
      "Standalone bundle is missing required runtime packages: fetch-blob"
    );
  });

  it("fails when the bundled API route emits an unhandled rejection on import", async () => {
    const root = createStandaloneRoot();
    tempRoots.push(root);
    addRequiredPackages(root);
    writeRouteEntry(
      root,
      "Promise.reject(new Error('module load failed')); export const GET = () => new Response('ok');"
    );

    await expect(assertApiRouteLoads(root)).rejects.toThrow("module load failed");
  });

  it("passes when required packages exist and the API route imports cleanly", async () => {
    const root = createStandaloneRoot();
    tempRoots.push(root);
    addRequiredPackages(root);
    writeRouteEntry(root, "export const GET = () => new Response('ok');");

    await expect(verifyStandaloneBundle(root)).resolves.toBeUndefined();
  });
});
