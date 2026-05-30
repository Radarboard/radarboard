/**
 * Graceful shutdown coordinator.
 *
 * Manages a registry of teardown callbacks that run when the process
 * receives SIGTERM or SIGINT. The sequence:
 * 1. Broadcast shutdown event via SSE gateway (if available)
 * 2. Run all registered teardown callbacks with a timeout
 * 3. Exit the process
 *
 * Register callbacks via `onShutdown(name, fn)`.
 * Initialize by calling `registerShutdownHandlers()` from instrumentation.ts.
 */

type ShutdownCallback = () => void | Promise<void>;

interface ShutdownEntry {
  name: string;
  callback: ShutdownCallback;
}

const callbacks: ShutdownEntry[] = [];
let shutdownInProgress = false;

/** Register a callback to run during graceful shutdown. */
export function onShutdown(name: string, callback: ShutdownCallback): void {
  callbacks.push({ name, callback });
}

/** Get the number of registered shutdown callbacks (for testing). */
export function getShutdownCallbackCount(): number {
  return callbacks.length;
}

/** Reset all callbacks (for testing). */
export function resetShutdownCallbacks(): void {
  callbacks.length = 0;
  shutdownInProgress = false;
}

/**
 * Execute the shutdown sequence.
 * Runs all callbacks with a timeout, then exits.
 */
export async function executeShutdown(timeoutMs = 10_000): Promise<void> {
  if (shutdownInProgress) return;
  shutdownInProgress = true;

  // Run all callbacks concurrently with a timeout
  const results = await Promise.allSettled(
    callbacks.map(async (entry) => {
      const timer = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Shutdown callback "${entry.name}" timed out`)),
          timeoutMs
        )
      );
      try {
        await Promise.race([entry.callback(), timer]);
      } catch (err) {
        const _message = err instanceof Error ? err.message : String(err);
      }
    })
  );

  const _failed = results.filter((r) => r.status === "rejected").length;
}

/**
 * Register process signal handlers for graceful shutdown.
 * Call once from instrumentation.ts. Safe to call in Edge Runtime (no-ops).
 */
export function registerShutdownHandlers(): void {
  // Guard: only register in Node.js runtime (not Edge)
  if (typeof globalThis.process === "undefined") return;
  if (typeof globalThis.process.on !== "function") return;

  const handler = async (signal: string) => {
    // Try to broadcast shutdown via SSE gateway
    try {
      const { emit } = await import("@/lib/event-gateway");
      emit("health", "server:shutdown", { signal, timestamp: Date.now() });
    } catch {
      // Gateway may not be initialized yet
    }

    await executeShutdown();
    globalThis.process.exit(0);
  };

  globalThis.process.on("SIGTERM", () => handler("SIGTERM"));
  globalThis.process.on("SIGINT", () => handler("SIGINT"));
}
