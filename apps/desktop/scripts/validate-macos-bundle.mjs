import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const EXPECTED_BUNDLE_EXECUTABLE = "radarboard-desktop";
const EXPECTED_BUNDLE_PACKAGE_TYPE = "APPL";
const SIDECAR_BINARY_NAME = "radarboard-server";
const SIDECAR_APP_NAME = "radarboard-server.app";

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

export function validateMacOsBundle({
  appPath,
  sourceDir,
  productName = "Radarboard",
  expectedExecutable = EXPECTED_BUNDLE_EXECUTABLE,
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
  };
}
