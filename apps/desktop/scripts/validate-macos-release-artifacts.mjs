#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { validateMacOsBundle } from "./validate-macos-bundle.mjs";

const DEFAULT_APP_PATH =
  "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Radarboard.app";

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

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `${command} ${args.map((arg) => JSON.stringify(arg)).join(" ")} failed${
        output ? `:\n${output}` : ""
      }`
    );
  }

  return result.stdout.trim();
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
}

function validateApp(appPath, options) {
  const resolvedAppPath = resolve(appPath);
  if (!existsSync(resolvedAppPath)) {
    throw new Error(`App bundle not found: ${resolvedAppPath}`);
  }

  const { sidecarBinaryPath } = validateMacOsBundle({ appPath: resolvedAppPath });
  const mainBinaryPath = join(resolvedAppPath, "Contents", "MacOS", "radarboard-desktop");

  validateSignature(mainBinaryPath);
  validateSignature(sidecarBinaryPath);

  for (const nativeFile of collectNativeFiles(join(resolvedAppPath, "Contents", "Resources"))) {
    validateSignature(nativeFile);
  }

  run("codesign", ["--verify", "--deep", "--strict", "--verbose=4", resolvedAppPath]);

  if (!options.skipSpctl) {
    run("spctl", ["--assess", "--type", "execute", "--verbose=4", resolvedAppPath]);
  }

  console.log(`[validate-macos-release-artifacts] OK: ${resolvedAppPath}`);
}

function validateDmg(dmgPath, options) {
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
    validateApp(join(mountPoint, "Radarboard.app"), options);
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

function main() {
  if (process.platform !== "darwin") {
    throw new Error("macOS release artifact validation must run on macOS.");
  }

  const args = parseArgs(process.argv.slice(2));
  validateApp(args.appPath, args);

  if (args.dmgPath) {
    validateDmg(args.dmgPath, args);
  }
}

try {
  main();
} catch (error) {
  console.error(
    `[validate-macos-release-artifacts] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
