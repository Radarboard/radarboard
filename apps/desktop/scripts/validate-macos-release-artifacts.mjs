#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateMacOsBundle } from "./validate-macos-bundle.mjs";

const DEFAULT_APP_PATH =
  "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Radarboard.app";
const SIDECAR_RUNTIME_ARGS = ["--jitless"];
const SIDECAR_STARTUP_TIMEOUT_MS = 15_000;

function parseArgs(argv) {
  const args = {
    appPath: DEFAULT_APP_PATH,
    dmgPath: null,
    skipSpctl: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--app") {
      args.appPath = argv.at(index + 1);
      index += 1;
    } else if (arg === "--dmg") {
      args.dmgPath = argv.at(index + 1);
      index += 1;
    } else if (arg === "--skip-spctl") {
      args.skipSpctl = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.appPath) {
    throw new Error("--app requires a path");
  }

  return args;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.map((arg) => JSON.stringify(arg)).join(" ")} failed${
        output ? `:\n${output}` : ""
      }`
    );
  }

  return output;
}

function collectNativeFiles(rootPath) {
  const nativeFiles = [];

  function walk(currentPath) {
    const entry = statSync(currentPath);
    if (entry.isFile()) {
      const name = basename(currentPath);
      if (name.endsWith(".node") || name.endsWith(".dylib")) {
        nativeFiles.push(currentPath);
      }
      return;
    }

    if (!entry.isDirectory()) return;

    for (const child of readdirSync(currentPath)) {
      walk(join(currentPath, child));
    }
  }

  walk(rootPath);
  return nativeFiles;
}

function validateSignature(path) {
  run("codesign", ["--verify", "--strict", "--verbose=4", path]);
  const signature = run("codesign", ["--display", "--verbose=4", path]);
  if (signature.includes("Authority=(unavailable)")) {
    throw new Error(
      `${path} is missing an embedded Apple certificate authority chain. ` +
        "Import the Developer ID intermediate certificates before signing."
    );
  }
  if (!signature.includes("Authority=Developer ID Application:")) {
    throw new Error(`${path} is not signed with a Developer ID Application certificate.`);
  }
}

export function getSidecarLaunchArgs(launcherPath) {
  return [...SIDECAR_RUNTIME_ARGS, launcherPath];
}

function trimOutput(value) {
  const trimmed = value.trim();
  return trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}...` : trimmed;
}

export async function validateSidecarRuntime({
  sidecarBinaryPath,
  resourceDir,
  timeoutMs = SIDECAR_STARTUP_TIMEOUT_MS,
}) {
  const launcherPath = join(resourceDir, "resources", "standalone", "launcher.mjs");
  if (!existsSync(launcherPath)) {
    throw new Error(`Sidecar launcher not found: ${launcherPath}`);
  }

  await new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    let timeout;

    const child = spawn(sidecarBinaryPath, getSidecarLaunchArgs(launcherPath), {
      env: {
        ...process.env,
        TAURI_RESOURCE_DIR: join(resourceDir, "resources"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const settle = (error) => {
      if (settled) return;
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }

      if (!child.killed) {
        child.kill("SIGTERM");
      }

      if (error) {
        rejectPromise(error);
      } else {
        resolvePromise();
      }
    };

    const runtimeOutput = () => {
      const parts = [];
      if (stdout.trim()) parts.push(`stdout:\n${trimOutput(stdout)}`);
      if (stderr.trim()) parts.push(`stderr:\n${trimOutput(stderr)}`);
      return parts.length > 0 ? `\n${parts.join("\n\n")}` : "";
    };

    timeout = setTimeout(() => {
      settle(
        new Error(
          `Sidecar runtime did not print a local URL within ${timeoutMs}ms.${runtimeOutput()}`
        )
      );
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const url = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.startsWith("http://127.0.0.1:"));
      if (url) {
        settle();
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      settle(new Error(`Failed to start sidecar runtime: ${error.message}`));
    });

    child.on("exit", (code, signal) => {
      if (settled) return;
      settle(
        new Error(
          `Sidecar runtime exited before printing a local URL (code=${code}, signal=${signal}).${runtimeOutput()}`
        )
      );
    });
  });
}

async function validateApp(appPath, options) {
  const resolvedAppPath = resolve(appPath);
  if (!existsSync(resolvedAppPath)) {
    throw new Error(`App bundle not found: ${resolvedAppPath}`);
  }

  const { sidecarBinaryPath } = validateMacOsBundle({ appPath: resolvedAppPath });
  const mainBinaryPath = join(resolvedAppPath, "Contents", "MacOS", "radarboard-desktop");
  const resourceDir = join(resolvedAppPath, "Contents", "Resources");

  validateSignature(mainBinaryPath);
  validateSignature(sidecarBinaryPath);

  for (const nativeFile of collectNativeFiles(join(resolvedAppPath, "Contents", "Resources"))) {
    validateSignature(nativeFile);
  }

  run("codesign", ["--verify", "--deep", "--strict", "--verbose=4", resolvedAppPath]);

  if (!options.skipSpctl) {
    run("spctl", ["--assess", "--type", "execute", "--verbose=4", resolvedAppPath]);
  }

  await validateSidecarRuntime({ sidecarBinaryPath, resourceDir });

  console.log(`[validate-macos-release-artifacts] OK: ${resolvedAppPath}`);
}

async function validateDmg(dmgPath, options) {
  const resolvedDmgPath = resolve(dmgPath);
  if (!existsSync(resolvedDmgPath)) {
    throw new Error(`DMG not found: ${resolvedDmgPath}`);
  }

  const mountPoint = mkdtempSync(join(tmpdir(), "radarboard-dmg-"));

  try {
    run("hdiutil", [
      "attach",
      resolvedDmgPath,
      "-nobrowse",
      "-readonly",
      "-mountpoint",
      mountPoint,
    ]);
    await validateApp(join(mountPoint, "Radarboard.app"), options);
  } finally {
    const detach = spawnSync("hdiutil", ["detach", mountPoint], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (detach.status !== 0) {
      console.warn(
        `[validate-macos-release-artifacts] Failed to detach ${mountPoint}: ${
          detach.stderr || detach.stdout
        }`
      );
    }
    rmSync(mountPoint, { force: true, recursive: true });
  }

  console.log(`[validate-macos-release-artifacts] OK: ${resolvedDmgPath}`);
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("macOS release artifact validation must run on macOS.");
  }

  const args = parseArgs(process.argv.slice(2));
  await validateApp(args.appPath, args);

  if (args.dmgPath) {
    await validateDmg(args.dmgPath, args);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(
      `[validate-macos-release-artifacts] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}
