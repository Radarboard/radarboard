import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getSidecarLaunchArgs,
  validateSidecarRuntime,
} from "./validate-macos-release-artifacts.mjs";

function uniqueTempDir(name: string) {
  return join(
    tmpdir(),
    `radarboard-validate-release-artifacts-${process.pid}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}-${name}`
  );
}

function writeLauncher(resourceDir: string, contents: string) {
  const standaloneDir = join(resourceDir, "resources", "standalone");
  mkdirSync(standaloneDir, { recursive: true });
  writeFileSync(join(standaloneDir, "launcher.mjs"), contents);
}

const tempDirs: string[] = [];

describe("validate-macos-release-artifacts", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("launches the sidecar with the desktop runtime flags", () => {
    expect(getSidecarLaunchArgs("/tmp/launcher.mjs")).toEqual(["--jitless", "/tmp/launcher.mjs"]);
  });

  it("passes when the sidecar prints a local URL", async () => {
    const resourceDir = uniqueTempDir("ready");
    tempDirs.push(resourceDir);
    writeLauncher(
      resourceDir,
      'process.stdout.write("http://127.0.0.1:61234\\n"); setInterval(() => {}, 1000);'
    );

    await expect(
      validateSidecarRuntime({
        sidecarBinaryPath: process.execPath,
        resourceDir,
        timeoutMs: 10_000,
      })
    ).resolves.toBeUndefined();
  });

  it("fails when the sidecar exits before printing a local URL", async () => {
    const resourceDir = uniqueTempDir("exit");
    tempDirs.push(resourceDir);
    writeLauncher(resourceDir, 'process.stderr.write("boom\\n"); process.exit(1);');

    await expect(
      validateSidecarRuntime({
        sidecarBinaryPath: process.execPath,
        resourceDir,
        timeoutMs: 10_000,
      })
    ).rejects.toThrow(/exited before printing a local URL/);
  });
});
