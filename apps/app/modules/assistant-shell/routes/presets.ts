import { createLogger } from "@radarboard/logger/logger";
import type { AssistantPresetConfig, LlmConfig } from "@radarboard/types/database";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettingsRepo } from "@/db/repository";
import { badRequest, handleRoute, parseBody } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";

const log = createLogger("api/chat/presets");
const presetBodySchema = z.record(z.string(), z.unknown());
const presetDeleteSchema = z.object({
  id: z.string().trim().min(1),
});

const EMPTY_LLM_CONFIG: LlmConfig = {};

function normalizePreset(input: Record<string, unknown>): AssistantPresetConfig | null {
  const id = typeof input.id === "string" ? input.id.trim() : crypto.randomUUID();
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const mode = typeof input.mode === "string" ? input.mode : "default";
  const modelId = typeof input.modelId === "string" ? input.modelId : null;
  const description = typeof input.description === "string" ? input.description.trim() : "";

  if (!name || !prompt) return null;
  if (!["default", "explore", "plan", "review", "qa"].includes(mode)) return null;

  return {
    id,
    name,
    prompt,
    mode,
    modelId,
    ...(description ? { description } : {}),
  } as AssistantPresetConfig;
}

export async function handleListPresets() {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const repo = getSettingsRepo();
      const config = await repo.getLlmConfig().catch(() => EMPTY_LLM_CONFIG);
      return NextResponse.json(config.assistantPresets ?? []);
    },
    {
      context: "Failed to list presets",
      onError: (error) => {
        log.error("Failed to list presets", { error });
      },
    }
  );
}

export async function handleUpsertPreset(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = await parseBody(request, presetBodySchema);
      if (!parsed.ok) return parsed.response;
      const preset = normalizePreset(parsed.data);
      if (!preset) {
        throw badRequest("id, name, prompt, and valid mode are required");
      }

      const repo = getSettingsRepo();
      const current = await repo.getLlmConfig().catch(() => EMPTY_LLM_CONFIG);
      const existing = current.assistantPresets ?? [];
      const next = existing.some((item: AssistantPresetConfig) => item.id === preset.id)
        ? existing.map((item: AssistantPresetConfig) => (item.id === preset.id ? preset : item))
        : [preset, ...existing];

      await repo.setLlmConfig({ ...current, assistantPresets: next });
      return NextResponse.json(preset);
    },
    {
      context: "Failed to save preset",
      onError: (error) => {
        log.error("Failed to save preset", { error });
      },
    }
  );
}

export async function handleDeletePreset(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = await parseBody(request, presetDeleteSchema);
      if (!parsed.ok) return parsed.response;
      const { id } = parsed.data;

      const repo = getSettingsRepo();
      const current = await repo.getLlmConfig().catch(() => EMPTY_LLM_CONFIG);
      const next = (current.assistantPresets ?? []).filter(
        (item: AssistantPresetConfig) => item.id !== id
      );
      await repo.setLlmConfig({ ...current, assistantPresets: next });
      return NextResponse.json({ success: true });
    },
    {
      context: "Failed to delete preset",
      onError: (error) => {
        log.error("Failed to delete preset", { error });
      },
    }
  );
}
