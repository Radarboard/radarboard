"use client";

import { Button } from "@radarboard/ui/button";
import { AlertTriangle, ChevronDown, RotateCcw } from "lucide-react";
import { useEffect } from "react";

/**
 * Next.js error boundary for the dashboard route.
 * Catches unhandled errors in the dashboard and its children,
 * preventing a full page crash.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to debug panel via custom event
    window.dispatchEvent(
      new CustomEvent("radarboard:error-boundary", {
        detail: {
          message: error.message,
          digest: error.digest,
          source: "dashboard",
        },
      })
    );
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden px-6 py-10">
      <div className="w-full max-w-screen-sm border border-border bg-surface shadow-2xl">
        <div className="border-border border-b px-5 py-4">
          <div className="font-mono text-dim text-w-sm uppercase tracking-widest">
            Dashboard Status
          </div>
        </div>

        <div className="space-y-6 px-5 py-8 sm:px-8">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-item border border-border bg-secondary text-foreground-secondary">
              <AlertTriangle className="icon-lg" />
            </div>
            <h2 className="font-sans font-semibold text-foreground text-w-2xl">
              The dashboard could not finish loading
            </h2>
            <p className="mt-2 max-w-md text-dim text-w-base leading-relaxed">
              This error has been logged. Try loading the dashboard again. If the issue persists,
              open the details below to inspect the captured message.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button onClick={reset} size="lg" rounded="none">
              <RotateCcw className="icon-xs" />
              Try Again
            </Button>
            <p className="font-mono text-dim text-w-sm uppercase tracking-wider">
              Your workspace configuration has not been changed
            </p>
          </div>

          {error.message ? (
            <details className="border border-border bg-secondary/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-mono text-dim text-w-sm uppercase tracking-widest transition-interactive hover:text-foreground-secondary">
                Error details
                <ChevronDown className="icon-xs shrink-0" />
              </summary>
              <div className="border-border border-t px-4 py-3">
                <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-destructive text-w-sm leading-relaxed">
                  {error.message}
                  {error.digest ? `\n\nDigest: ${error.digest}` : ""}
                </pre>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
