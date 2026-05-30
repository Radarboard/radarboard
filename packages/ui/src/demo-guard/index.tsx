"use client";

import { cn } from "@radarboard/utils/cn";
import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";

interface DemoGuardProps {
  children: ReactNode;
  /** Whether demo mode is active. */
  isDemoMode: boolean;
  /** Message shown in the demo banner. */
  message?: string;
  /** Fully disable pointer events on children. Defaults to true. */
  disableInteraction?: boolean;
  /** Additional className on the wrapper. */
  className?: string;
}

/**
 * Wraps a section to make it read-only when demo mode is active.
 * Shows a warning banner and disables all pointer events on children.
 */
export function DemoGuard({
  children,
  isDemoMode,
  message = "Demo mode — this section is read-only. Connect your services to make changes.",
  disableInteraction = true,
  className,
}: DemoGuardProps) {
  if (!isDemoMode) return <>{children}</>;

  return (
    <div className={cn("flex flex-1 flex-col overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-warning/30 border-b bg-warning/10 px-4 py-2">
        <FlaskConical className="icon-sm shrink-0 text-warning" />
        <span className="font-mono text-w-sm text-warning">{message}</span>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto",
          disableInteraction && "pointer-events-none select-none"
        )}
        aria-disabled={disableInteraction}
      >
        {children}
      </div>
    </div>
  );
}
