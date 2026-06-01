"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { X } from "lucide-react";
import type React from "react";

export interface DetailPanelShellProps {
  /** Header content — title text or editable element */
  title: React.ReactNode;
  /** Subtitle line (e.g. timestamps, word count) */
  subtitle?: React.ReactNode;
  /** Action buttons (pin, archive, trash) rendered in the header */
  actions?: React.ReactNode;
  /** Close button handler — shown when provided (drawer mode) */
  onClose?: () => void;
  /** Footer content (metadata, timestamps, tags) */
  footer?: React.ReactNode;
  /** Main scrollable content */
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared detail panel layout used by plugin detail views.
 *
 * Provides a consistent structure:
 * ```
 * [Header: title + actions + close]
 * [Scrollable content]
 * [Footer: metadata]
 * ```
 */
export function DetailPanelShell({
  title,
  subtitle,
  actions,
  onClose,
  footer,
  children,
  className,
}: DetailPanelShellProps) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="shrink-0 border-border border-b px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground-secondary text-w-sm">{title}</div>
            {Boolean(subtitle) && (
              <div className="mt-1 flex items-center gap-3 font-mono text-dim text-w-sm">
                {subtitle}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            {Boolean(onClose) && (
              <Button
                type="button"
                onClick={onClose}
                variant="ghost"
                size="icon"
                uppercase={false}
                className="text-dim hover:text-muted-foreground"
                aria-label="Close"
              >
                <X className="icon-base" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden">{children}</div>

      {/* Footer */}
      {Boolean(footer) && <div className="shrink-0 border-border border-t px-4 py-2">{footer}</div>}
    </div>
  );
}
