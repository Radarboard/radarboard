"use client";

import type { IntentPayload, IntentPayloadInput } from "@radarboard/types/intent";
import { cn } from "@radarboard/utils/cn";
import {
  Content as ContextMenuContent,
  Item as ContextMenuItem,
  Portal as ContextMenuPortal,
  Root as ContextMenuRoot,
  Separator as ContextMenuSeparator,
  Sub as ContextMenuSub,
  SubContent as ContextMenuSubContent,
  SubTrigger as ContextMenuSubTrigger,
  Trigger as ContextMenuTrigger,
} from "@radix-ui/react-context-menu";
import { MessageSquarePlus, Send } from "lucide-react";
import { type ReactNode, useCallback, useMemo } from "react";
import { intentBus } from "../intent-bus";
import type { ResolvedIntentTarget } from "../types";
import { usePluginAPI } from "../use-plugin-api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SendToContextMenuProps {
  children: ReactNode;
  /** The payload to send — sourcePluginId is auto-injected. */
  payload: IntentPayloadInput;
  /** The source plugin ID (used for resolving targets and injecting sourcePluginId). */
  sourcePluginId: string;
  /** Extra context menu items rendered above the "Send to…" section. */
  extraItems?: ReactNode;
}

// ---------------------------------------------------------------------------
// Shared menu-item styles
// ---------------------------------------------------------------------------

const itemClass = cn(
  "flex items-center gap-2 px-3 py-1.5 text-w-sm text-foreground-secondary outline-none",
  "cursor-default select-none rounded-sm",
  "data-[highlighted]:bg-secondary data-[highlighted]:text-foreground-secondary"
);

const subContentClass = cn(
  "min-w-[180px] py-1 bg-surface-raised border border-border rounded-md shadow-lg",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
  "data-[side=right]:slide-in-from-left-1"
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SendToContextMenu({
  children,
  payload,
  sourcePluginId,
  extraItems,
}: SendToContextMenuProps) {
  const api = usePluginAPI();

  const fullPayload = useMemo(
    (): IntentPayload => ({ ...payload, sourcePluginId }) as IntentPayload,
    [payload, sourcePluginId]
  );

  const targets = useMemo(() => intentBus.resolveTargets(fullPayload), [fullPayload]);

  const handleSendTo = useCallback(
    async (target: ResolvedIntentTarget) => {
      const result = await api.intents.sendTo(target.pluginId, target.action, payload);
      if (result.success) {
        api.notify(result.message ?? `Sent to ${target.pluginName}`, "success");
      } else {
        api.notify(result.message ?? "Failed to send", "error");
      }
    },
    [api, payload]
  );

  const handleSendToAssistant = useCallback(async () => {
    await api.intents.sendToAssistant(payload);
    api.notify("Sent to Assistant", "success");
  }, [api, payload]);

  return (
    <ContextMenuRoot>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuPortal>
        <ContextMenuContent className="z-50 min-w-[180px] rounded-md border border-border bg-surface-raised py-1 shadow-lg">
          {/* Plugin-specific actions passed from the parent */}
          {extraItems}

          {/* Separator before "Send to" */}
          {Boolean(extraItems) && <ContextMenuSeparator className="my-1 h-px bg-border" />}

          {/* "Send to…" submenu */}
          {targets.length > 0 ? (
            <ContextMenuSub>
              <ContextMenuSubTrigger className={itemClass}>
                <Send className="icon-base" />
                Send to…
                <span className="ml-auto text-dim">▸</span>
              </ContextMenuSubTrigger>
              <ContextMenuPortal>
                <ContextMenuSubContent className={subContentClass} sideOffset={4}>
                  {targets.map((target) => {
                    const Icon = target.icon ?? target.pluginIcon;
                    return (
                      <ContextMenuItem
                        key={`${target.pluginId}:${target.action}`}
                        className={itemClass}
                        onSelect={() => handleSendTo(target)}
                      >
                        <Icon className="icon-base" />
                        {target.label}
                      </ContextMenuItem>
                    );
                  })}

                  <ContextMenuSeparator className="my-1 h-px bg-border" />

                  <ContextMenuItem className={itemClass} onSelect={() => handleSendToAssistant()}>
                    <MessageSquarePlus className="icon-base" />
                    Discuss with Assistant
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuPortal>
            </ContextMenuSub>
          ) : (
            /* If no plugin targets, still show "Discuss with Assistant" as a top-level item */
            <ContextMenuItem className={itemClass} onSelect={() => handleSendToAssistant()}>
              <MessageSquarePlus className="icon-base" />
              Discuss with Assistant
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenuRoot>
  );
}

// ---------------------------------------------------------------------------
// Re-export primitives for plugin-specific context menus
// ---------------------------------------------------------------------------

export const SendToContextMenuItem = ContextMenuItem;
export const SendToContextMenuSeparator = ContextMenuSeparator;
