/**
 * @radarboard/feature-workflows
 *
 * Isolated workflow automation feature package.
 * Exports the feature descriptor, context initialization, and public API.
 */

import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";

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
};

export { initWorkflowContext } from "./context";
export type { WorkflowContext } from "./context";
export { startWorkflowScheduler, executeWorkflow } from "./scheduler";
export { buildWorkflowToolExecutors } from "./tools";
export { createWorkflow, listWorkflows, deleteWorkflow, getWorkflow } from "./repository";
export {
  createWorkflowRoute,
  deleteWorkflowRoute,
  listWorkflowsRoute,
} from "./server/routes";
