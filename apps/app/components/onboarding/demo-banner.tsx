"use client";

import { Button } from "@radarboard/ui/button";
import { FlaskConical, X } from "lucide-react";
import { useState } from "react";
import { useDemoModeActions } from "@/lib/demo-data";

interface DemoBannerProps {
  onConnectServices?: () => void;
}

export function DemoBanner({ onConnectServices }: DemoBannerProps) {
  const { isDemoMode, connectRealData, startFresh } = useDemoModeActions();
  const [dismissed, setDismissed] = useState(false);

  if (!isDemoMode || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-warning/30 border-b bg-warning/10 px-4 py-2 font-mono text-w-sm">
      <div className="flex items-center gap-2 text-warning">
        <FlaskConical className="icon-sm shrink-0" />
        <span>
          You&apos;re viewing <strong>demo data</strong>. Connect your services to see real data.
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onConnectServices ? (
          <Button
            variant="outline"
            onClick={() => {
              connectRealData()
                .finally(onConnectServices)
                .catch(() => undefined);
            }}
            className="h-6 rounded-item px-2.5 font-mono text-w-sm uppercase tracking-widest"
          >
            Connect real services
          </Button>
        ) : null}
        <Button
          variant="ghost"
          onClick={() => {
            startFresh().catch(() => undefined);
            setDismissed(true);
          }}
          className="h-6 rounded-item px-2 font-mono text-dim text-w-sm uppercase tracking-widest hover:text-foreground-secondary"
        >
          <X className="icon-sm" />
          <span className="hidden sm:inline">Start fresh</span>
        </Button>
      </div>
    </div>
  );
}
