"use client";

import { cn } from "@radarboard/utils/cn";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message: ReactNode;
  subMessage?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** If true, uses a more compact monospace style suitable for widgets */
  variant?: "default" | "compact";
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  subMessage,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  if (variant === "compact") {
    return (
      <div className={cn("flex h-full items-center justify-center px-4 text-center", className)}>
        <div>
          <p className="font-mono text-dim text-w-sm">{message}</p>
          {subMessage !== undefined && subMessage !== null ? (
            <p className="mt-1 font-mono text-dim text-w-sm">{subMessage}</p>
          ) : null}
          {action !== undefined && action !== null ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-none p-8 text-center",
        className
      )}
    >
      {Icon !== undefined && Icon !== null ? <Icon className="icon-lg mb-3 text-dim" /> : null}
      {title !== undefined && title !== null ? (
        <h3 className="mb-1 font-medium text-foreground text-w-base">{title}</h3>
      ) : null}
      <div className="mx-auto max-w-[280px] text-dim text-w-sm">{message}</div>
      {subMessage !== undefined && subMessage !== null ? (
        <div className="mx-auto mt-1 max-w-[280px] text-dim text-w-xs">{subMessage}</div>
      ) : null}
      {action !== undefined && action !== null ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
