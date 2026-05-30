"use client";

import { ListRowChip, PluginListRow } from "@radarboard/plugin-sdk/components/list-row";
import { PluginEmptyState } from "@radarboard/plugin-sdk/components/plugin-empty";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { formatRelativeTimeMs } from "@radarboard/plugin-sdk/utils";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { Trash2 } from "lucide-react";
import type { RelayEventSummary } from "../types";
import { useWebhookRelay } from "../use-webhook-relay";

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-accent",
};

function EventRow({ event }: { event: RelayEventSummary }) {
  return (
    <PluginListRow
      dotColor={SEVERITY_DOT[event.severity] ?? "bg-dim"}
      title={event.title}
      subtitle={event.body}
      meta={formatRelativeTimeMs(event.receivedAt)}
      chips={
        <>
          <ListRowChip>{event.integration}</ListRowChip>
          <ListRowChip>{event.type}</ListRowChip>
        </>
      }
    />
  );
}

function RelayHeader({
  statusColor,
  totalEvents,
  stats,
}: {
  statusColor: string;
  totalEvents: number;
  stats: { byIntegration: Record<string, number> } | null;
}) {
  return (
    <div className="border-border border-b bg-surface px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className={cn("font-bold font-mono text-2xl", statusColor)}>{totalEvents}</span>
        <span className="text-dim text-xs">events buffered</span>
      </div>
      {stats != null && (
        <div className="mt-2 flex items-center gap-3">
          {Object.entries(stats.byIntegration).map(([name, count]) => (
            <div key={name} className="flex items-center gap-1">
              <span className="font-mono text-muted-foreground text-xs">{count}</span>
              <span className="text-dim text-w-sm">{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WebhookRelayOverlay({ api }: PluginRenderProps) {
  const { events, stats, loaded, clearEvents } = useWebhookRelay(api);

  if (!loaded) {
    return <PluginEmptyState title="Loading relay events..." />;
  }

  const status = stats?.pollStatus ?? "unconfigured";
  const getStatusColor = () => {
    if (status === "connected") return "text-emerald-400";
    if (status === "error") return "text-red-400";
    return "text-dim";
  };
  const statusColor = getStatusColor();

  const getStatusLabel = () => {
    if (status === "connected") return "Relay connected";
    if (status === "error") return "Relay error";
    return "Not configured";
  };
  const statusLabel = getStatusLabel();

  const emptyTitle = status === "unconfigured" ? "Relay not configured" : "No webhook events yet";
  const emptyDescription =
    status === "unconfigured"
      ? "Configure the relay URL in Settings > Integrations to start receiving events."
      : "Events will appear as they arrive.";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <RelayHeader statusColor={statusColor} totalEvents={stats?.totalEvents ?? 0} stats={stats} />

      <div className="flex items-center gap-2 border-border border-b px-3 py-2">
        <span className={cn("font-mono text-w-sm", statusColor)}>{statusLabel}</span>
        <div className="flex-1" />
        {events.length > 0 && (
          <Button
            type="button"
            onClick={clearEvents}
            variant="outline"
            size="sm"
            uppercase={false}
            className="gap-1.5 text-muted-foreground hover:bg-red-400/10 hover:text-red-400"
          >
            <Trash2 className="icon-sm" />
            Clear
          </Button>
        )}
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden">
        {events.length === 0 ? (
          <PluginEmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="divide-y divide-border">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
