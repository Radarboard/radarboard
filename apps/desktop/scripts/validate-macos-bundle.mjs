import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const EXPECTED_BUNDLE_EXECUTABLE = "Radarboard";
const EXPECTED_BUNDLE_PACKAGE_TYPE = "APPL";
const SIDECAR_BINARY_NAME = "radarboard-helper";
const SIDECAR_APP_NAME = "radarboard-helper.app";
const MAX_SEALED_APP_FILES = 1500;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractPlistStringValue(plistContents, key) {
  const match = plistContents.match(
    new RegExp(`<key>${escapeRegExp(key)}</key>\\s*<string>([^<]+)</string>`)
  );
  return match?.[1] ?? null;
}

export function readBundleMetadata(infoPlistPath) {
  const plistContents = readFileSync(infoPlistPath, "utf8");
  return {
    executable: extractPlistStringValue(plistContents, "CFBundleExecutable"),
    packageType: extractPlistStringValue(plistContents, "CFBundlePackageType"),
  };
}

export function collectAppBundles(rootPath) {
  const bundles = [];

  function walk(currentPath) {
    if (!existsSync(currentPath)) return;

    const entry = lstatSync(currentPath);
    if (entry.isSymbolicLink()) return;

    if (basename(currentPath).endsWith(".app")) {
      bundles.push(resolve(currentPath));
    }

    if (!entry.isDirectory()) return;

    for (const child of readdirSync(currentPath)) {
      walk(join(currentPath, child));
    }
  }

  walk(rootPath);
  return bundles;
}

export function countRegularFiles(rootPath) {
  let fileCount = 0;

  function walk(currentPath) {
    if (!existsSync(currentPath)) return;

    const entry = lstatSync(currentPath);
    if (entry.isSymbolicLink()) return;

    if (entry.isFile()) {
      fileCount += 1;
      return;
    }

    if (!entry.isDirectory()) return;

    for (const child of readdirSync(currentPath)) {
      walk(join(currentPath, child));
    }
  }

  walk(rootPath);
  return fileCount;
}

export function validateMacOsBundle({
  appPath,
  sourceDir,
  productName = "Radarboard",
  expectedExecutable = EXPECTED_BUNDLE_EXECUTABLE,
  maxSealedFileCount = MAX_SEALED_APP_FILES,
} = {}) {
  const resolvedAppPath = resolve(appPath);
  if (!existsSync(resolvedAppPath)) {
    throw new Error(`App bundle not found: ${resolvedAppPath}`);
  }

  const infoPlistPath = join(resolvedAppPath, "Contents", "Info.plist");
  if (!existsSync(infoPlistPath)) {
    throw new Error(`App bundle is missing Info.plist: ${infoPlistPath}`);
  }

  const metadata = readBundleMetadata(infoPlistPath);
  if (metadata.packageType !== EXPECTED_BUNDLE_PACKAGE_TYPE) {
    throw new Error(
      `App bundle has CFBundlePackageType=${metadata.packageType ?? "missing"} at ${infoPlistPath}; expected ${EXPECTED_BUNDLE_PACKAGE_TYPE} so only the main app is treated as a Dock app.`
    );
  }

  if (metadata.executable !== expectedExecutable) {
    throw new Error(
      `App bundle has CFBundleExecutable=${metadata.executable ?? "missing"} at ${infoPlistPath}; expected ${expectedExecutable} so the main Dock app remains Radarboard.`
    );
  }

  const sidecarBinaryPath = join(resolvedAppPath, "Contents", "MacOS", SIDECAR_BINARY_NAME);
  if (!existsSync(sidecarBinaryPath) || !statSync(sidecarBinaryPath).isFile()) {
    throw new Error(
      `App bundle is missing helper executable ${sidecarBinaryPath}; the sidecar must remain a plain binary inside the main app bundle.`
    );
  }

  const resourceRoot = join(resolvedAppPath, "Contents", "Resources", "resources");
  const launcherPath = join(resourceRoot, "standalone", "launcher.mjs");
  const archivePath = join(resourceRoot, "standalone-runtime.tar.gz");
  const unpackedRuntimePath = join(resourceRoot, "standalone-runtime");

  if (!existsSync(launcherPath) || !statSync(launcherPath).isFile()) {
    throw new Error(
      `App bundle is missing sidecar launcher ${launcherPath}; the desktop runtime must launch through the extracted archive wrapper.`
    );
  }

  if (!existsSync(archivePath) || !statSync(archivePath).isFile()) {
    throw new Error(
      `App bundle is missing archived sidecar runtime ${archivePath}; shipping the full runtime tree directly in the .app can make Gatekeeper reject downloaded DMGs.`
    );
  }

  if (existsSync(unpackedRuntimePath)) {
    throw new Error(
      `App bundle contains unpacked sidecar runtime ${unpackedRuntimePath}; package it as ${archivePath} so Gatekeeper does not scan thousands of sealed files.`
    );
  }

  const sealedFileCount = countRegularFiles(resolvedAppPath);
  if (sealedFileCount > maxSealedFileCount) {
    throw new Error(
      `App bundle contains ${sealedFileCount} sealed files; expected at most ${maxSealedFileCount}. Keep the sidecar runtime archived so downloaded DMGs pass Gatekeeper assessment.`
    );
  }

  const nestedBundles = collectAppBundles(resolvedAppPath).filter(
    (bundlePath) => bundlePath !== resolvedAppPath
  );
  const nestedSidecarApp = nestedBundles.find(
    (bundlePath) => basename(bundlePath) === SIDECAR_APP_NAME
  );
  if (nestedSidecarApp) {
    throw new Error(
      `Nested app bundle detected at ${nestedSidecarApp}; ${SIDECAR_APP_NAME} would risk appearing as an extra macOS app surface.`
    );
  }

  if (sourceDir) {
    const resolvedSourceDir = resolve(sourceDir);
    const bundlePaths = collectAppBundles(resolvedSourceDir);
    const expectedAppPath = resolve(join(resolvedSourceDir, `${productName}.app`));

    const nestedSidecarInSource = bundlePaths.find(
      (bundlePath) => basename(bundlePath) === SIDECAR_APP_NAME
    );
    if (nestedSidecarInSource) {
      throw new Error(
        `DMG staging contains ${nestedSidecarInSource}; ${SIDECAR_APP_NAME} must never be packaged as a separate app bundle.`
      );
    }

    const extraBundles = bundlePaths.filter((bundlePath) => bundlePath !== expectedAppPath);
    if (extraBundles.length > 0) {
      throw new Error(
        `DMG staging contains extra app bundles (${extraBundles.join(", ")}); only ${expectedAppPath} should be present so users see a single Dock app.`
      );
    }
  }

  return {
    appPath: resolvedAppPath,
    sidecarBinaryPath,
    sealedFileCount,
  };
}
