import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_PACKAGES = ["node-fetch", "jsdom"];

export function getMissingPackages(standaloneRoot) {
  const nodeModulesDir = join(standaloneRoot, "node_modules");
  return REQUIRED_PACKAGES.filter((pkg) => !existsSync(join(nodeModulesDir, pkg, "package.json")));
}

export function assertRequiredPackages(standaloneRoot) {
  const missingPackages = getMissingPackages(standaloneRoot);
  if (missingPackages.length === 0) return;

  throw new Error(
    `Standalone bundle is missing required runtime packages: ${missingPackages.join(", ")}`
  );
}

function normalizeError(error) {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

async function withUnhandledErrorTrap(run, settleMs = 250) {
  const unhandledErrors = [];

  const onUnhandledRejection = (reason) => {
    unhandledErrors.push(normalizeError(reason));
  };
  const onUncaughtException = (error) => {
    unhandledErrors.push(normalizeError(error));
  };

  process.on("unhandledRejection", onUnhandledRejection);
  process.on("uncaughtException", onUncaughtException);

  try {
    await run();
    await new Promise((resolve) => setTimeout(resolve, settleMs));
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
    process.off("uncaughtException", onUncaughtException);
  }

  if (unhandledErrors.length > 0) {
    throw unhandledErrors[0];
  }
}

export async function assertApiRouteLoads(standaloneRoot) {
  const routeEntry = join(
    standaloneRoot,
    "apps",
    "app",
    ".next",
    "server",
    "app",
    "api",
    "[...path]",
    "route.js"
  );

  if (!existsSync(routeEntry)) {
    throw new Error(`Standalone API route entry not found: ${routeEntry}`);
  }

  await withUnhandledErrorTrap(async () => {
    const moduleUrl = pathToFileURL(routeEntry);
    moduleUrl.searchParams.set("verify", String(Date.now()));
    await import(moduleUrl.href);
  });
}

export async function verifyStandaloneBundle(standaloneRoot) {
  assertRequiredPackages(standaloneRoot);
  await assertApiRouteLoads(standaloneRoot);
}

async function main() {
  const standaloneRoot = process.argv[2];
  if (!standaloneRoot) {
    throw new Error("Usage: node verify-sidecar-bundle.mjs <standalone-root>");
  }

  await verifyStandaloneBundle(standaloneRoot);
  console.log(`[verify-sidecar-bundle] OK: ${standaloneRoot}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      `[verify-sidecar-bundle] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
