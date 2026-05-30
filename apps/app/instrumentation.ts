/**
 * Next.js instrumentation hook — runs once on cold start.
 *
 * Validates environment variables so the server fails fast with a clear
 * error message listing all missing/invalid vars, rather than crashing
 * opaquely on first use.
 */

export async function register() {
  if (process.env.NODE_ENV === "test") return;

  // Validate environment variables
  try {
    const { validateEnv } = await import("./lib/system/runtime/env");
    validateEnv();
  } catch (_err) {
    if (process.env.NODE_ENV === "development") {
      // Continue with invalid env in dev — warn was already printed
    }
  }

  // Node.js-only features (shutdown handlers, workflow scheduler).
  // Separated into instrumentation.node.ts to avoid Edge Runtime
  // bundler pulling in node:crypto, node:fs, node:path.
  if (process.env.NEXT_RUNTIME !== "edge") {
    try {
      const { registerNodeFeatures } = await import("./instrumentation.node");
      await registerNodeFeatures();
    } catch (_err) {
      // Non-critical — Edge Runtime or missing module
    }
  }
}
