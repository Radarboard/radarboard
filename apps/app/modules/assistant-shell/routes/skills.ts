import { listBuiltinSkills } from "@radarboard/llm/skills/registry";
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmRepo } from "@/db/repository";
import { handleRoute, parseBody, parseSearchParams } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";

const log = createLogger("api/chat/skills");
const listSkillsQuerySchema = z.object({
  scope: z.string().optional(),
});
const skillBodySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  instructions: z.string().optional(),
  enabled: z.boolean().optional(),
});
const skillDeleteSchema = z.object({
  id: z.string().min(1),
});

export async function handleListSkills(request?: Request) {
  if (!isFeatureEnabled("assistant") || !isFeatureEnabled("skills")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = request
        ? parseSearchParams(new URL(request.url).searchParams, listSkillsQuerySchema)
        : null;
      if (parsed && !parsed.ok) return parsed.response;
      const scope = parsed?.data.scope ?? null;
      const repo = getLlmRepo();
      const skills = await repo.listSkills();

      if (scope === "composer") {
        const builtinSkills = listBuiltinSkills().map((skill) => ({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          builtin: true,
        }));
        const customSkills = skills
          .filter((skill) => skill.enabled)
          .map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            builtin: false,
          }));
        return NextResponse.json([...builtinSkills, ...customSkills]);
      }

      return NextResponse.json(skills);
    },
    {
      context: "Failed to list skills",
      onError: (error) => {
        log.error("Failed to list skills", { error });
      },
    }
  );
}

export async function handleUpsertSkill(request: Request) {
  if (!isFeatureEnabled("assistant") || !isFeatureEnabled("skills")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = await parseBody(request, skillBodySchema);
      if (!parsed.ok) return parsed.response;
      const { name } = parsed.data;
      const description = parsed.data.description?.trim() ?? "";
      const instructions = parsed.data.instructions?.trim() ?? "";

      const id = parsed.data.id ?? crypto.randomUUID();
      const now = new Date().toISOString();

      const repo = getLlmRepo();
      await repo.upsertSkill({
        id,
        name,
        description,
        instructions,
        enabled: parsed.data.enabled !== false,
        createdAt: now,
        updatedAt: now,
      });

      return NextResponse.json({
        id,
        name,
        description,
        instructions,
        enabled: parsed.data.enabled !== false,
      });
    },
    {
      context: "Failed to save skill",
      onError: (error) => {
        log.error("Failed to save skill", { error });
      },
    }
  );
}

export async function handleDeleteSkill(request: Request) {
  if (!isFeatureEnabled("assistant") || !isFeatureEnabled("skills")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = await parseBody(request, skillDeleteSchema);
      if (!parsed.ok) return parsed.response;

      const repo = getLlmRepo();
      await repo.deleteSkill(parsed.data.id);
      return NextResponse.json({ success: true });
    },
    {
      context: "Failed to delete skill",
      onError: (error) => {
        log.error("Failed to delete skill", { error });
      },
    }
  );
}
