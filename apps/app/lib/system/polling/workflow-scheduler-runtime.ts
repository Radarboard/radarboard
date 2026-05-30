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
    const { initWorkflowContext, startWorkflowScheduler } = await import(
      "@radarboard/feature-workflows"
    );
    const { getSettingsRepo, getCredentialRepo } = await import("@/data/core/repository");
    const { buildDataSourceContext } = await import("@/lib/data-source-context");
    const { emitNotificationEvents } = await import("@/lib/notifications");
    const { emitDebugEvent } = await import("@/lib/debug-events");
    const repo = getSettingsRepo();

    initWorkflowContext({
      getWorkflows: () =>
        repo.getWorkflows() as Promise<
          Record<string, import("@radarboard/feature-workflows/types").Workflow>
        >,
      setWorkflows: (workflows) => repo.setWorkflows(workflows),
      getCredentialRepo,
      buildDataSourceContext,
      emitNotification: (events) =>
        emitNotificationEvents(events as Parameters<typeof emitNotificationEvents>[0]),
      emitDebugEvent: (event) => emitDebugEvent(event).catch(() => undefined),
    });

    startWorkflowScheduler();
  })().catch((error) => {
    startPromise = null;
    throw error;
  });

  return startPromise;
}
