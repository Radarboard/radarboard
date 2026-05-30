"use client";

import { getAssistantModeOptions } from "@radarboard/assistant-core/assistant-workflows";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { useChatContext } from "./chat-context";

/**
 * Compact workflow mode picker inside the composer using standardized Select.
 */
export function ChatModeSelector() {
  const { selectedMode, setSelectedMode } = useChatContext();
  const options = getAssistantModeOptions();

  return (
    <Select value={selectedMode} onValueChange={(v) => setSelectedMode(v as typeof selectedMode)}>
      <SelectTrigger
        variant="outline"
        size="sm"
        className="w-fit min-w-[90px] font-bold text-dim uppercase tracking-widest transition-colors hover:text-foreground"
        aria-label="Select assistant workflow mode"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
