import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadLocalDevExtensions,
  mergeConfigWithLocalDevExtensions,
} from "../generate-extensions-init";

const tempDirs: string[] = [];

function tempManifest(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "radarboard-dev-ext-"));
  tempDirs.push(dir);
  const manifest = join(dir, "dev-extensions.json");
  writeFileSync(manifest, JSON.stringify(content, null, 2));
  return manifest;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("dev extension manifest", () => {
  it("loads valid local dev extensions", () => {
    const manifest = tempManifest({
      devExtensions: [{ type: "widget", path: "../community/widgets/demo" }],
    });

    expect(loadLocalDevExtensions(manifest)).toEqual([
      { type: "widget", path: "../community/widgets/demo" },
    ]);
  });

  it("merges local dev extensions after config extensions", () => {
    const manifest = tempManifest({
      devExtensions: [{ type: "plugin", path: "../community/plugins/demo" }],
    });

    const config = mergeConfigWithLocalDevExtensions(
      {
        devExtensions: [{ type: "widget", path: "../existing/widget" }],
        features: [],
        integrations: [],
        virtualIntegrations: [],
        plugins: [],
        widgets: [],
      },
      manifest
    );

    expect(config.devExtensions).toEqual([
      { type: "widget", path: "../existing/widget" },
      { type: "plugin", path: "../community/plugins/demo" },
    ]);
  });
});
