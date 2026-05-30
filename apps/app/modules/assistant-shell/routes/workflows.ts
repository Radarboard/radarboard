import {
  createWorkflowRoute,
  deleteWorkflowRoute,
  listWorkflowsRoute,
} from "@radarboard/feature-workflows/server/routes";
import type { WorkflowStep, WorkflowTrigger } from "@radarboard/feature-workflows/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, parseSearchParams } from "@/lib/api";

const workflowBodySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  trigger: z.object({ type: z.string() }).passthrough(),
  steps: z.array(z.unknown()),
});
const workflowDeleteSchema = z.object({
  id: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().min(1, "id required")
  ),
});

export async function handleListWorkflows() {
  return NextResponse.json(await listWorkflowsRoute());
}

export async function handleCreateWorkflow(request: Request) {
  const parsed = await parseBody(request, workflowBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const workflow = await createWorkflowRoute({
    name: body.name,
    description: body.description ?? "",
    trigger: body.trigger as unknown as WorkflowTrigger,
    steps: body.steps as WorkflowStep[],
  });
  return NextResponse.json(workflow, { status: 201 });
}

export async function handleDeleteWorkflow(request: Request) {
  const parsed = parseSearchParams(new URL(request.url).searchParams, workflowDeleteSchema);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(await deleteWorkflowRoute(parsed.data.id));
}
