/**
 * @radarboard/feature-workflows
 *
 * Isolated workflow automation feature package.
 * Exports the feature descriptor, context initialization, and public API.
 */

import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";
import {
  createWorkflowRoute,
  deleteWorkflowRoute,
  listWorkflowsRoute,
} from "./server/routes";
import { buildWorkflowToolExecutors } from "./tools";
import type { WorkflowStep, WorkflowTrigger } from "./types";

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
