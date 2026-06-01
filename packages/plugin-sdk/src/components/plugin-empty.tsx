"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import type React from "react";

export interface PluginEmptyStateProps {
  /** Icon displayed above the message */
  icon?: React.ReactNode;
  /** Primary message */
  title: string;
  /** Secondary descriptive text */
  description?: string;
  /** Optional CTA button */
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Consistent empty state for plugin views.
 *
 * Replaces the various inline `<div className="text-w-sm text-dim text-center">` patterns
 * scattered across plugin overlays.
 */
export function PluginEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: PluginEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className
      )}
    >
      {Boolean(icon) && <div className="text-dim">{icon}</div>}
      <div className="space-y-1">
        <p className="text-foreground-secondary text-w-base">{title}</p>
        {Boolean(description) && <p className="max-w-xs text-dim text-w-sm">{description}</p>}
      </div>
      {action != null ? (
        <Button
          type="button"
          onClick={action.onClick}
          variant="outline"
          size="default"
          uppercase={false}
          className="mt-2"
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
