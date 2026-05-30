import { withLogging } from "@radarboard/logger/middleware";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getNotificationRepo } from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";

const ConditionSchema = z.object({
  scope: z.enum(["event", "metadata"]),
  field: z.string().min(1),
  operator: z.enum([
    "equals",
    "not_equals",
    "contains",
    "greater_than",
    "greater_than_or_equal",
    "less_than",
    "less_than_or_equal",
  ]),
  valueType: z.enum(["string", "number", "boolean"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const RuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  enabled: z.boolean(),
  source: z.string().nullable().optional(),
  eventType: z.string().nullable().optional(),
  severity: z.enum(["critical", "warning", "info"]).nullable().optional(),
  projectSlug: z.string().nullable().optional(),
  condition: ConditionSchema.nullable().optional(),
  channels: z.array(z.enum(["in_app", "email", "desktop", "webhook", "mcp"])),
  createdAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
});

const DeleteSchema = z.object({ id: z.string().min(1) });

export const handleGetRules = withLogging(API_ROUTES.notificationRules, async () => {
  const repo = getNotificationRepo();
  if (!repo) return NextResponse.json({ rules: [] });
  const rules = await repo.getRules();
  return NextResponse.json({ rules });
});

export const handleUpsertRule = withLogging(
  API_ROUTES.notificationRules,
  async (request: Request) => {
    const repo = getNotificationRepo();
    if (!repo) {
      return errorJson(501, "Notifications not supported by current provider");
    }
    const parsed = await parseBody(request, RuleSchema);
    if (!parsed.ok) return parsed.response;
    const now = Math.floor(Date.now() / 1000);
    await repo.upsertRule({
      id: parsed.data.id,
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      source: parsed.data.source ?? null,
      eventType: parsed.data.eventType ?? null,
      severity: parsed.data.severity ?? null,
      projectSlug: parsed.data.projectSlug ?? null,
      condition: parsed.data.condition ?? null,
      channels: parsed.data.channels,
      createdAt: parsed.data.createdAt ?? now,
      updatedAt: parsed.data.updatedAt ?? now,
    });
    return NextResponse.json({ success: true });
  }
);

export const handleDeleteRule = withLogging(
  API_ROUTES.notificationRules,
  async (request: Request) => {
    const repo = getNotificationRepo();
    if (!repo) {
      return errorJson(501, "Notifications not supported by current provider");
    }
    const parsed = await parseBody(request, DeleteSchema);
    if (!parsed.ok) return parsed.response;
    await repo.deleteRule(parsed.data.id);
    return NextResponse.json({ success: true });
  }
);
