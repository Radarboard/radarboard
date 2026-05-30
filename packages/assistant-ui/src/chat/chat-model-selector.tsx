"use client";

import { getEnabledModelsForProvider } from "@radarboard/assistant-core/model-preferences";
import { useCredentials } from "@radarboard/hooks/use-credentials";
import { listProviders } from "@radarboard/llm/providers/registry";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { useMemo } from "react";
import { useChatContext } from "./chat-context";

interface ModelGroup {
  providerId: string;
  providerName: string;
  models: { id: string; name: string }[];
}

function useAvailableModelGroups(excludeModel?: string | null): ModelGroup[] {
  const { connectedKeys } = useCredentials();

  return useMemo(() => {
    const groups: ModelGroup[] = [];

    for (const provider of listProviders()) {
      if (!connectedKeys.includes(provider.credentialKeyPrefix)) continue;

      const enabledIds = getEnabledModelsForProvider(provider.id);
      const models = provider.models
        .filter((model) => !enabledIds || enabledIds.includes(model.id))
        .map((model) => ({
          id: `${provider.id}:${model.id}`,
          name: model.name,
        }))
        .filter((model) => model.id !== excludeModel);

      if (models.length > 0) {
        groups.push({ providerId: provider.id, providerName: provider.name, models });
      }
    }

    return groups;
  }, [connectedKeys, excludeModel]);
}

function InlineModelSelector({
  value,
  onChange,
  emptyLabel,
  ariaLabel,
  className,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  emptyLabel: string;
  ariaLabel: string;
  className?: string;
}) {
  const groups = useAvailableModelGroups();

  return (
    <Select value={value ?? ""} onValueChange={(v) => onChange(v || null)}>
      <SelectTrigger variant="outline" size="sm" className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={emptyLabel} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectGroup key={group.providerId}>
            <SelectGroupLabel>{group.providerName}</SelectGroupLabel>
            {group.models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Compact primary model picker inside the composer.
 */
export function ChatModelSelector() {
  const { selectedModel, setSelectedModel } = useChatContext();

  return (
    <InlineModelSelector
      value={selectedModel}
      onChange={setSelectedModel}
      emptyLabel="Auto"
      ariaLabel="Select AI model"
      className="w-fit min-w-[80px] font-bold text-dim uppercase tracking-widest transition-colors hover:text-foreground"
    />
  );
}

/**
 * Optional challenger model picker shown for review mode.
 */
export function ChatChallengerSelector() {
  const { challengerModel, setChallengerModel } = useChatContext();

  return (
    <InlineModelSelector
      value={challengerModel}
      onChange={setChallengerModel}
      emptyLabel="No challenge"
      ariaLabel="Select challenger model"
      className="w-fit min-w-[120px] font-bold text-dim uppercase tracking-widest transition-colors hover:text-foreground"
    />
  );
}
