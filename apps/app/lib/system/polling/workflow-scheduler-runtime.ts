import { getWebEnv } from "@/lib/env";

let startPromise: Promise<void> | null = null;

export async function ensureWorkflowSchedulerStarted(): Promise<void> {
  if (getWebEnv("NEXT_RUNTIME") === "edge" || getWebEnv("NODE_ENV") === "test") {
    return;
  }

  if (startPromise !== null) {
    return startPromise;
  }

  startPromise = (async () => {
    const { getFeatureServerBackground } = await import(
      "@/lib/extensions/runtime/server/feature-server"
    );
    const startScheduler = getFeatureServerBackground("workflows", "scheduler");
    startScheduler?.();
  })().catch((error) => {
    startPromise = null;
    throw error;
  });

  return startPromise;
}
