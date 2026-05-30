/**
 * Workflow AI tool definitions.
 *
 * Returns tool definitions for create/list/delete workflow operations.
 * Used by the host app's ai-tools.ts to register workflow tools with the LLM.
 */

import { createWorkflow, deleteWorkflow, listWorkflows } from "./repository";
import type { WorkflowStep, WorkflowTrigger } from "./types";

/**
 * Build workflow tool execute functions.
 * Returns an object with execute functions keyed by tool name.
 * The host app wraps these with the AI SDK's tool() helper.
 */
export function buildWorkflowToolExecutors() {
  return {
    create_workflow: async (params: {
      name: string;
      description: string;
      triggerType: string;
      triggerConfig: Record<string, unknown>;
      steps: Record<string, unknown>[];
    }) => {
      const trigger = {
        type: params.triggerType,
        ...params.triggerConfig,
      } as WorkflowTrigger;
      const steps = params.steps as unknown as WorkflowStep[];
      const workflow = await createWorkflow(params.name, params.description, trigger, steps);
      return { created: true, workflowId: workflow.id, name: workflow.name };
    },

    list_workflows: async () => {
      const workflows = await listWorkflows();
      return {
        workflows: workflows.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          trigger: w.trigger,
          enabled: w.enabled,
        })),
      };
    },

    delete_workflow: async (params: { workflowId: string }) => {
      const deleted = await deleteWorkflow(params.workflowId);
      return { deleted };
    },
  };
}
