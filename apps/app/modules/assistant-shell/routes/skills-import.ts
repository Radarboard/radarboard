import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmRepo } from "@/db/repository";
import {
  fetchSkillFromRepo,
  listRepoSkills,
  parseSkillsCommand,
} from "@/lib/ai-actions/install-skill";
import { errorJson, parseBody } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";

const log = createLogger("api/chat/skills/import");
const skillImportSchema = z.object({
  command: z.string().min(1),
  skillName: z.string().optional(),
});

export async function handleImportSkill(request: Request) {
  if (!isFeatureEnabled("assistant") || !isFeatureEnabled("skills")) return featureNotFound();
  try {
    const parsedBody = await parseBody(request, skillImportSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { command, skillName: pickedSkill } = parsedBody.data;

    const parsed = parseSkillsCommand(command);
    if (!parsed) {
      return errorJson(
        400,
        "Could not parse command. Expected format: npx skills add owner/repo --skill name"
      );
    }

    const { owner, repo } = parsed;
    const targetSkill = pickedSkill ?? parsed.skillName;

    if (targetSkill) {
      const skill = await fetchSkillFromRepo(owner, repo, targetSkill);
      if (!skill) {
        return errorJson(404, `Skill "${targetSkill}" not found in ${owner}/${repo}`);
      }

      const llmRepo = getLlmRepo();
      await llmRepo.upsertSkill({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        installed: true,
        skill: { id: skill.id, name: skill.name, description: skill.description },
      });
    }

    const available = await listRepoSkills(owner, repo);

    if (available.length === 0) {
      return errorJson(
        404,
        `No skills found in ${owner}/${repo}. Check that the repo has skills/ directories with SKILL.md files.`
      );
    }

    if (available.length === 1) {
      const onlySkill = available[0];
      if (!onlySkill) {
        return errorJson(500, "Failed to resolve repository skill");
      }
      const skill = await fetchSkillFromRepo(owner, repo, onlySkill.name);
      if (!skill) {
        return errorJson(500, "Failed to fetch skill content");
      }

      const llmRepo = getLlmRepo();
      await llmRepo.upsertSkill({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        installed: true,
        skill: { id: skill.id, name: skill.name, description: skill.description },
      });
    }

    return NextResponse.json({
      installed: false,
      availableSkills: available,
      owner,
      repo,
      message: `Found ${available.length} skills in ${owner}/${repo}. Pick one to install.`,
    });
  } catch (err) {
    log.error("Skill import failed", { error: err });
    return errorJson(500, err instanceof Error ? err.message : "Failed to import skill");
  }
}
