import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, parseSearchParams } from "@/lib/api";
import { getFeatureServerRoute } from "@/lib/extensions/runtime/server/feature-server";

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
  const route = getFeatureServerRoute("workflows", "list");
  if (!route)
    return NextResponse.json(
      { error: "Workflows feature route is not registered" },
      { status: 404 }
    );

  const result = await route({
    request: new Request("http://radarboard.local/api/workflows"),
    body: {},
  });
  return NextResponse.json(result.payload, { status: result.status });
}

export async function handleCreateWorkflow(request: Request) {
  const parsed = await parseBody(request, workflowBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const route = getFeatureServerRoute("workflows", "create");
  if (!route)
    return NextResponse.json(
      { error: "Workflows feature route is not registered" },
      { status: 404 }
    );

  const result = await route({
    request,
    body,
  });
  return NextResponse.json(result.payload, { status: result.status });
}

export async function handleDeleteWorkflow(request: Request) {
  const parsed = parseSearchParams(new URL(request.url).searchParams, workflowDeleteSchema);
  if (!parsed.ok) return parsed.response;
  const route = getFeatureServerRoute("workflows", "delete");
  if (!route)
    return NextResponse.json(
      { error: "Workflows feature route is not registered" },
      { status: 404 }
    );

  const result = await route({
    request,
    body: { id: parsed.data.id },
  });
  return NextResponse.json(result.payload, { status: result.status });
}
