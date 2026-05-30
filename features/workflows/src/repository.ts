/**
 * Workflow CRUD operations.
 *
 * Provides create/list/delete/get operations for workflows.
 * Uses WorkflowContext for persistence (injected by host app).
 */

import { getWorkflowContext } from "./context";
import type { Workflow, WorkflowStep, WorkflowTrigger } from "./types";

async function loadWorkflows(): Promise<Record<string, Workflow>> {
  const ctx = getWorkflowContext();
  return ctx.getWorkflows();
}

async function saveWorkflows(workflows: Record<string, Workflow>): Promise<void> {
  const ctx = getWorkflowContext();
  await ctx.setWorkflows(workflows);
}

export async function createWorkflow(
  name: string,
  description: string,
  trigger: WorkflowTrigger,
  steps: WorkflowStep[]
): Promise<Workflow> {
  const workflow: Workflow = {
    id: crypto.randomUUID(),
    name,
    description,
    trigger,
    steps,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const workflows = await loadWorkflows();
  workflows[workflow.id] = workflow;
  await saveWorkflows(workflows);
  return workflow;
}

export async function listWorkflows(): Promise<Workflow[]> {
  const workflows = await loadWorkflows();
  return Object.values(workflows);
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const workflows = await loadWorkflows();
  if (!(id in workflows)) return false;
  delete workflows[id];
  await saveWorkflows(workflows);
  return true;
}

export async function getWorkflow(id: string): Promise<Workflow | undefined> {
  const workflows = await loadWorkflows();
  return workflows[id];
}

/** Reset store (for testing). */
export async function resetWorkflowStore(): Promise<void> {
  await saveWorkflows({});
}
