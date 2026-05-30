"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { Plug } from "lucide-react";

interface Provider {
  id: string;
  name: string;
}

export interface WidgetNotConfiguredProps {
  serviceName: string;
  /** Credential key for deep-linking. Omit for multi-provider widgets. */
  serviceId?: string;
  /** Optional full message override. */
  message?: string;
  /** Optional button label override. */
  actionLabel?: string;
  onConnect?: (serviceId: string) => void;
  providers?: Provider[];
  className?: string;
}

export function WidgetNotConfigured({
  serviceName,
  serviceId,
  message,
  actionLabel,
  onConnect,
  providers,
  className,
}: WidgetNotConfiguredProps) {
  const buttons =
    providers && providers.length > 1
      ? providers
      : serviceId
        ? [{ id: serviceId, name: serviceName }]
        : [];

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 px-4 text-center",
        className
      )}
    >
      <Plug className="size-5 text-dim" />
      <p className="font-mono text-dim text-w-sm">{message ?? `${serviceName} not connected`}</p>
      {onConnect && (
        <div className="flex flex-wrap justify-center gap-2">
          {buttons.length > 0 ? (
            buttons.map((b) => (
              <Button
                key={b.id}
                type="button"
                onClick={() => onConnect(b.id)}
                variant="outline-accent"
                uppercase={false}
                aria-label={actionLabel ?? `Connect ${b.name}`}
              >
                {actionLabel ?? `Connect ${b.name}`}
              </Button>
            ))
          ) : (
            <Button
              type="button"
              onClick={() => onConnect("")}
              variant="outline-accent"
              uppercase={false}
              aria-label={actionLabel ?? "Configure in Settings"}
            >
              {actionLabel ?? "Configure in Settings"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
