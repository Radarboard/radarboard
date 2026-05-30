/**
 * WorkflowContext — dependency injection interface.
 *
 * The workflow feature needs access to app-specific infrastructure
 * (database, notifications, debug events) that lives in apps/app.
 * Instead of importing these directly, the host app provides concrete
 * implementations via initWorkflowContext() at startup.
 */

import type { DataSourceContext } from "@radarboard/integration-sdk/types";
import type { CredentialRepository } from "@radarboard/types/database";
import type { Workflow } from "./types";

export interface WorkflowContext {
  /** Load all workflows from persistence. */
  getWorkflows(): Promise<Record<string, Workflow>>;
  /** Persist all workflows. */
  setWorkflows(workflows: Record<string, Workflow>): Promise<void>;
  /** Get credential repository for LLM provider resolution. */
  getCredentialRepo(): CredentialRepository;
  /** Build the data source context for integration fetches. */
  buildDataSourceContext(): DataSourceContext;
  /** Emit notification events (fire-and-forget). */
  emitNotification(events: Array<{
    source: string;
    type: string;
    severity: "critical" | "warning" | "info" | "success";
    title: string;
    body?: string | null;
    projectSlug?: string | null;
    metadata?: Record<string, unknown>;
  }>): void;
  /** Emit a debug event (fire-and-forget). */
  emitDebugEvent(event: {
    level: "info" | "warn" | "error" | "debug";
    source: string;
    eventType: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): void;
}

let ctx: WorkflowContext | null = null;

/** Initialize the workflow context. Must be called before using any workflow functions. */
export function initWorkflowContext(c: WorkflowContext): void {
  ctx = c;
}

/** Get the workflow context. Throws if not initialized. */
export function getWorkflowContext(): WorkflowContext {
  if (!ctx) throw new Error("WorkflowContext not initialized — call initWorkflowContext() first");
  return ctx;
}
