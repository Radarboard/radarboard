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
}
