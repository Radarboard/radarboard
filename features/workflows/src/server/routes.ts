import type { WorkflowStep, WorkflowTrigger } from "../types";
import { createWorkflow, deleteWorkflow, listWorkflows } from "../repository";

export async function listWorkflowsRoute() {
  const workflows = await listWorkflows();
  return { workflows };
}

export async function createWorkflowRoute(body: {
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
}) {
  return createWorkflow(body.name, body.description ?? "", body.trigger, body.steps);
}

export async function deleteWorkflowRoute(id: string) {
  return { deleted: await deleteWorkflow(id) };
}
