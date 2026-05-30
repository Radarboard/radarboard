"use client";

import { Button } from "@radarboard/ui/button";
import { Switch } from "@radarboard/ui/switch";
import { cn } from "@radarboard/utils/cn";
import type { ReactNode } from "react";

interface SettingsCatalogCardProps {
  className?: string;
  icon?: ReactNode;
  title: ReactNode;
  titleMeta?: ReactNode;
  description?: ReactNode;
  enabled?: boolean;
  status?: ReactNode;
  badges?: ReactNode;
  onOpen?: () => void;
  openAriaLabel?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  switchAriaLabel?: string;
}

export function SettingsCatalogCard({
  icon,
  title,
  titleMeta,
  description,
  enabled = true,
  status,
  badges,
  onOpen,
  openAriaLabel,
  checked,
  onCheckedChange,
  switchAriaLabel,
  className,
}: SettingsCatalogCardProps) {
  return (
    <div
      data-enabled={enabled}
      className={cn(
        "relative flex h-auto w-full flex-col items-stretch justify-start rounded-item border transition-colors",
        enabled
          ? "border-border bg-surface-raised hover:border-accent/40"
          : "border-border bg-surface hover:border-accent/20",
        className
      )}
    >
      {onOpen ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onOpen}
          aria-label={openAriaLabel}
          uppercase={false}
          rounded="none"
          className="absolute inset-0 z-0 h-full w-full hover:bg-transparent"
        />
      ) : null}

      <div className="pointer-events-none relative z-10 flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon !== undefined && icon !== null ? <div className="shrink-0">{icon}</div> : null}
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium font-mono text-foreground text-w-base">
                  {title}
                </span>
                {titleMeta !== undefined && titleMeta !== null ? (
                  <span className="shrink-0 font-mono text-muted-foreground text-w-sm">
                    {titleMeta}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {onCheckedChange ? (
            <div className="pointer-events-auto shrink-0">
              <Switch
                checked={checked}
                onCheckedChange={onCheckedChange}
                aria-label={switchAriaLabel}
              />
            </div>
          ) : null}
        </div>

        {description !== undefined && description !== null ? (
          <div className="line-clamp-2 text-foreground-secondary text-w-base leading-relaxed">
            {description}
          </div>
        ) : null}

        {status !== undefined && status !== null ? <div className="min-w-0">{status}</div> : null}

        {badges !== undefined && badges !== null ? (
          <div className="flex flex-wrap gap-1.5">{badges}</div>
        ) : null}
      </div>
    </div>
  );
}
