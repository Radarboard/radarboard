"use client";

import { Button } from "@radarboard/ui/button";
import { AlertTriangle, ChevronDown, RotateCcw } from "lucide-react";

/**
 * Global error boundary — catches errors in the root layout.
 * This is the last-resort fallback when even the dashboard layout fails.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error.message?.trim() || "An unexpected error interrupted the app.";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen overflow-hidden bg-background text-foreground antialiased">
        <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden px-6 py-10">
          <div className="relative w-full max-w-screen-sm border border-border bg-surface shadow-2xl">
            <div className="border-border border-b px-5 py-4">
              <div className="font-mono text-dim text-w-sm uppercase tracking-widest">
                System Status
              </div>
            </div>

            <div className="space-y-6 px-5 py-8 sm:px-8">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-item border border-border bg-secondary text-foreground-secondary">
                  <AlertTriangle className="icon-lg" />
                </div>
                <h1 className="font-sans font-semibold text-foreground text-w-2xl">
                  We hit a problem loading Radarboard
                </h1>
                <p className="mt-2 max-w-md text-dim text-w-base leading-relaxed">
                  The app ran into an unexpected issue. Try loading this screen again. If it keeps
                  happening, the technical details below will help with debugging.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3">
                <Button onClick={reset} size="lg" rounded="none">
                  <RotateCcw className="icon-xs" />
                  Try Again
                </Button>
                <p className="font-mono text-dim text-w-sm uppercase tracking-wider">
                  Radarboard keeps your session intact when possible
                </p>
              </div>

              <details className="border border-border bg-secondary/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-mono text-dim text-w-sm uppercase tracking-widest transition-interactive hover:text-foreground-secondary">
                  Error details
                  <ChevronDown className="icon-xs shrink-0" />
                </summary>
                <div className="border-border border-t px-4 py-3">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-destructive text-w-sm leading-relaxed">
                    {message}
                    {error.digest ? `\n\nDigest: ${error.digest}` : ""}
                    {error.stack ? `\n\n${error.stack}` : ""}
                  </pre>
                </div>
              </details>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
