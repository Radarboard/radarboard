/**
 * Node.js-only instrumentation — imported by instrumentation.ts only in Node.js runtime.
 * This file is NOT analyzed by the Edge Runtime bundler.
 */

export async function registerNodeFeatures() {
  // Register graceful shutdown handlers
  try {
    const { registerShutdownHandlers } = await import("./lib/utils/control/shutdown");
    registerShutdownHandlers();
  } catch (_err) {
    // Non-critical
  }

  // Re-register user-defined (no-code) REST integrations persisted in settings,
  // so they're available in the registry alongside the built-in integrations.
  try {
    const { ensureUserIntegrationsRegistered } = await import(
      "./lib/integrations/user-integrations-registry"
    );
    await ensureUserIntegrationsRegistered();
  } catch (_err) {
    // Non-critical — falls back to lazy registration on first data fetch.
  }
}
