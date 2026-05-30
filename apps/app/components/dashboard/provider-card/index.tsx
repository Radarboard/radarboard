"use client";

import type { ProviderInfo } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";

interface DatabaseProviderCardProps {
  provider: ProviderInfo;
  selected: boolean;
  onSelect: () => void;
}

export function DatabaseProviderCard({ provider, selected, onSelect }: DatabaseProviderCardProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      uppercase={false}
      onClick={onSelect}
      className={cn(
        "h-auto w-full min-w-0 flex-col items-start overflow-hidden whitespace-normal rounded-item border bg-surface p-4 text-left transition-colors",
        selected ? "border-accent" : "border-border hover:border-border"
      )}
    >
      <p className="min-w-0 font-mono font-semibold text-foreground text-w-base">{provider.name}</p>
      <p className="mt-1 min-w-0 text-wrap break-words font-mono text-dim text-w-sm">
        {provider.description}
      </p>
      {provider.fields.length === 0 && (
        <span className="mt-2 inline-block rounded-item border border-accent/30 px-1.5 py-0.5 font-mono text-accent text-w-sm uppercase tracking-wider">
          No setup required
        </span>
      )}
    </Button>
  );
}
