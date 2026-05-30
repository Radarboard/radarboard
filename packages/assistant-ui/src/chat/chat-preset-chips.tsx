"use client";

import { BUILTIN_ASSISTANT_STARTERS } from "@radarboard/assistant-core/presets";
import { API_ROUTES } from "@radarboard/types/api-routes";
import type { AssistantMode, AssistantPresetConfig } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { SparklesIcon } from "lucide-react";
import useSWR from "swr";

async function fetchPresets(url: string): Promise<AssistantPresetConfig[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load presets: ${response.status}`);
  }
  return (await response.json()) as AssistantPresetConfig[];
}

export function ChatPresetChips({
  onSelect,
}: {
  onSelect: (preset: {
    id: string;
    prompt: string;
    mode: AssistantMode;
    modelId: string | null;
  }) => void;
}) {
  const { data: customPresets = [] } = useSWR<AssistantPresetConfig[]>(
    API_ROUTES.chatPresets,
    fetchPresets,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const presets = [
    ...BUILTIN_ASSISTANT_STARTERS,
    ...customPresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      prompt: preset.prompt,
      mode: preset.mode,
      modelId: preset.modelId ?? null,
    })),
  ];

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      {presets.map((preset) => (
        <Button
          key={preset.id}
          type="button"
          onClick={() => onSelect(preset)}
          variant="outline"
          uppercase={false}
          className="gap-1.5 bg-surface text-dim hover:border-accent/50 hover:text-foreground hover:shadow-sm"
        >
          <SparklesIcon size={14} />
          {preset.name}
        </Button>
      ))}
    </div>
  );
}
