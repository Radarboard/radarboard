/**
 * @radarboard/feature-workflows
 *
 * Isolated workflow automation feature package.
 * Exports the feature descriptor, context initialization, and public API.
 */

import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";
import type { DataSourceContext } from "@radarboard/integration-sdk/types";
import type { CredentialRepository } from "@radarboard/types/database";
import { initWorkflowContext } from "./context";
import {
  createWorkflowRoute,
  deleteWorkflowRoute,
  listWorkflowsRoute,
} from "./server/routes";
import { startWorkflowScheduler } from "./scheduler";
import { buildWorkflowToolExecutors } from "./tools";
import type { Workflow, WorkflowStep, WorkflowTrigger } from "./types";

interface WorkflowServerServices {
  getWorkflows(): Promise<Record<string, Workflow>>;
  setWorkflows(workflows: Record<string, Workflow>): Promise<void>;
  getCredentialRepo(): CredentialRepository;
  buildDataSourceContext(): DataSourceContext;
  emitNotificationEvents(events: Array<{
    source: string;
    type: string;
    severity: "critical" | "warning" | "info" | "success";
    title: string;
    body?: string | null;
    projectSlug?: string | null;
    metadata?: Record<string, unknown>;
  }>): void;
  emitDebugEvent(event: {
    level: "info" | "warn" | "error" | "debug";
    source: string;
    eventType: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null>;
}

function getWorkflowServerServices(services: Record<string, unknown>): WorkflowServerServices {
  return services as unknown as WorkflowServerServices;
}

export const workflowsDescriptor: FeatureDescriptor = {
  id: "workflows",
  envKey: "NEXT_PUBLIC_FEATURE_WORKFLOWS",
  label: "Workflows",
  description: "Automation workflows for recurring tasks.",
  defaultEnabled: true,
  tier: "user",
  plan: "pro",
  category: "automation",
  settingsSections: ["workflows"],
  gatedTools: ["create_workflow", "list_workflows", "delete_workflow"],
  server: {
    configure: ({ services }) => {
      const workflowServices = getWorkflowServerServices(services);
      initWorkflowContext({
        getWorkflows: workflowServices.getWorkflows,
        setWorkflows: workflowServices.setWorkflows,
        getCredentialRepo: workflowServices.getCredentialRepo,
        buildDataSourceContext: workflowServices.buildDataSourceContext,
        emitNotification: (events) => workflowServices.emitNotificationEvents(events),
        emitDebugEvent: (event) => {
          void workflowServices.emitDebugEvent(event);
        },
      });
    },
    routes: {
      list: async () => ({ status: 200, payload: await listWorkflowsRoute() }),
      create: async ({ body }) => ({
        status: 201,
        payload: await createWorkflowRoute({
          name: String(body.name ?? ""),
          description: typeof body.description === "string" ? body.description : "",
          trigger: body.trigger as WorkflowTrigger,
          steps: (Array.isArray(body.steps) ? body.steps : []) as WorkflowStep[],
        }),
      }),
      delete: async ({ body }) => ({
        status: 200,
        payload: await deleteWorkflowRoute(String(body.id ?? "")),
      }),
    },
    background: {
      scheduler: () => startWorkflowScheduler(),
    },
  },
  assistant: {
    toolExecutors: () => buildWorkflowToolExecutors(),
  },
};

export { initWorkflowContext } from "./context";
export type { WorkflowContext } from "./context";
export { startWorkflowScheduler, executeWorkflow } from "./scheduler";
export { buildWorkflowToolExecutors } from "./tools";
export { createWorkflow, listWorkflows, deleteWorkflow, getWorkflow } from "./repository";
export { createWorkflowRoute, deleteWorkflowRoute, listWorkflowsRoute };
