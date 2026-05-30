import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateMacOsBundle } from "./validate-macos-bundle.mjs";

function uniqueTempDir(name: string) {
  return join(
    tmpdir(),
    `radarboard-validate-macos-bundle-${process.pid}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}-${name}`
  );
}

function writeInfoPlist(
  appPath: string,
  {
    executable = "radarboard-desktop",
    packageType = "APPL",
  }: { executable?: string; packageType?: string } = {}
) {
  const infoPlistPath = join(appPath, "Contents", "Info.plist");
  mkdirSync(join(appPath, "Contents"), { recursive: true });
  writeFileSync(
    infoPlistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>${executable}</string>
  <key>CFBundlePackageType</key>
  <string>${packageType}</string>
</dict>
</plist>`
  );
}

function writeSidecarBinary(appPath: string) {
  const sidecarPath = join(appPath, "Contents", "MacOS", "radarboard-server");
  mkdirSync(join(appPath, "Contents", "MacOS"), { recursive: true });
  writeFileSync(sidecarPath, "sidecar");
}

function createValidBundle(rootDir: string, appName = "Radarboard.app") {
  const appPath = join(rootDir, appName);
  writeInfoPlist(appPath);
  writeSidecarBinary(appPath);
  return appPath;
}

const tempDirs: string[] = [];

describe("validate-macos-bundle", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("passes for a single app bundle with a plain sidecar binary", () => {
    const sourceDir = uniqueTempDir("valid");
    tempDirs.push(sourceDir);
    const appPath = createValidBundle(sourceDir);
    symlinkSync("/Applications", join(sourceDir, "Applications"));

    expect(() =>
      validateMacOsBundle({
        appPath,
        sourceDir,
        productName: "Radarboard",
      })
    ).not.toThrow();
  });

  it("fails when a nested radarboard-server app bundle exists", () => {
    const sourceDir = uniqueTempDir("nested-sidecar-app");
    tempDirs.push(sourceDir);
    const appPath = createValidBundle(sourceDir);
    createValidBundle(join(appPath, "Contents", "Resources"), "radarboard-server.app");

    expect(() => validateMacOsBundle({ appPath })).toThrow(/Nested app bundle detected/);
  });

  it("fails when the DMG staging area contains multiple app bundles", () => {
    const sourceDir = uniqueTempDir("extra-app");
    tempDirs.push(sourceDir);
    const appPath = createValidBundle(sourceDir);
    createValidBundle(sourceDir, "Helper.app");

    expect(() =>
      validateMacOsBundle({
        appPath,
        sourceDir,
        productName: "Radarboard",
      })
    ).toThrow(/DMG staging contains extra app bundles/);
  });

  it("fails when the main bundle executable changes", () => {
    const sourceDir = uniqueTempDir("wrong-executable");
    tempDirs.push(sourceDir);
    const appPath = join(sourceDir, "Radarboard.app");
    writeInfoPlist(appPath, { executable: "radarboard-server" });
    writeSidecarBinary(appPath);

    expect(() => validateMacOsBundle({ appPath })).toThrow(/CFBundleExecutable/);
  });

  it("fails when the sidecar binary is missing", () => {
    const sourceDir = uniqueTempDir("missing-sidecar");
    tempDirs.push(sourceDir);
    const appPath = join(sourceDir, "Radarboard.app");
    writeInfoPlist(appPath);

    expect(() => validateMacOsBundle({ appPath })).toThrow(/missing helper executable/);
  });
});
