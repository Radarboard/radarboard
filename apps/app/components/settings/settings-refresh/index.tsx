"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import {
  formatPollingInterval,
  getEffectivePollingInterval,
  getPollingAllowedIntervals,
  POLLING_SOURCE_REGISTRY,
  type PollingSourceDefinition,
} from "@radarboard/types/polling";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { useMemo, useState } from "react";
import {
  SettingsCardSection,
  SettingsGrid,
  SettingsPageLayout,
  SettingsPanel,
} from "../settings-page-layout";

type PollingCategory = NonNullable<PollingSourceDefinition["category"]>;

interface PollingSourceEntry {
  sourceId: string;
  definition: PollingSourceDefinition;
}

const CATEGORY_LABELS: Record<PollingCategory, string> = {
  app: "App Surfaces",
  plugin: "Plugin Widgets",
  widget: "Core Widgets",
};

function buildSourceSearchText(sourceId: string, definition: PollingSourceDefinition): string {
  const integrations = definition.dataSources.map((source) => source.integration).join(" ");
  const widgets = definition.widgetIds.join(" ");

  return [
    sourceId,
    definition.label,
    definition.description ?? "",
    definition.category ?? "",
    integrations,
    widgets,
  ]
    .join(" ")
    .toLowerCase();
}

function PollingSourceCard({
  sourceId,
  definition,
  effectiveInterval,
  hasOverride,
  onIntervalChange,
  onReset,
}: {
  sourceId: string;
  definition: PollingSourceDefinition;
  effectiveInterval: number;
  hasOverride: boolean;
  onIntervalChange: (intervalMs: number) => void;
  onReset: () => void;
}) {
  const integrations = Array.from(
    new Set(definition.dataSources.map((source) => source.integration))
  );
  const appliesToCount = definition.widgetIds.length;

  return (
    <SettingsPanel title={definition.label} description={definition.description}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono text-dim text-w-sm uppercase tracking-widest">Refresh</div>
          <div className="font-mono text-foreground text-w-sm">
            {formatPollingInterval(effectiveInterval)}
          </div>
        </div>

        <Select
          value={String(effectiveInterval)}
          onValueChange={(value) => onIntervalChange(Number(value))}
        >
          <SelectTrigger size="lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getPollingAllowedIntervals(sourceId).map((intervalMs) => (
              <SelectItem key={intervalMs} value={String(intervalMs)}>
                {formatPollingInterval(intervalMs)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="space-y-2 rounded-item border border-border border-dashed bg-muted p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-dim text-w-sm">
              {hasOverride
                ? `Custom override. Default is ${formatPollingInterval(definition.defaultIntervalMs)}.`
                : `Using the default interval of ${formatPollingInterval(definition.defaultIntervalMs)}.`}
            </span>
            {hasOverride ? (
              <Button type="button" variant="ghost" className="h-7 px-2" onClick={onReset}>
                Use default
              </Button>
            ) : null}
          </div>

          <div className="text-dim text-w-sm">
            Source ID: <span className="font-mono text-foreground-secondary">{sourceId}</span>
          </div>
          {integrations.length > 0 ? (
            <div className="text-dim text-w-sm">
              Integrations:{" "}
              <span className="font-mono text-foreground-secondary">{integrations.join(", ")}</span>
            </div>
          ) : null}
          {appliesToCount > 0 ? (
            <div className="text-dim text-w-sm">
              Widgets: <span className="font-mono text-foreground-secondary">{appliesToCount}</span>
            </div>
          ) : null}
        </div>
      </div>
    </SettingsPanel>
  );
}

export function SettingsRefresh() {
  const { preferences, updatePreferences } = useDashboard();
  const [searchQuery, setSearchQuery] = useState("");

  const allSources = useMemo<PollingSourceEntry[]>(
    () =>
      Array.from(POLLING_SOURCE_REGISTRY.entries())
        .map(([sourceId, definition]) => ({ sourceId, definition }))
        .sort((left, right) => {
          const categoryCompare = (left.definition.category ?? "widget").localeCompare(
            right.definition.category ?? "widget"
          );
          if (categoryCompare !== 0) return categoryCompare;
          return left.definition.label.localeCompare(right.definition.label);
        }),
    []
  );

  const filteredSources = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allSources;
    return allSources.filter(({ sourceId, definition }) =>
      buildSourceSearchText(sourceId, definition).includes(query)
    );
  }, [allSources, searchQuery]);

  const groupedSources = useMemo(() => {
    const groups = new Map<PollingCategory, PollingSourceEntry[]>();
    for (const entry of filteredSources) {
      const category = entry.definition.category ?? "widget";
      const existing = groups.get(category) ?? [];
      existing.push(entry);
      groups.set(category, existing);
    }
    return groups;
  }, [filteredSources]);

  function updatePollingPreference(sourceId: string, intervalMs: number) {
    const definition = POLLING_SOURCE_REGISTRY.get(sourceId);
    if (!definition) return;

    const nextPolling = { ...(preferences.polling ?? {}) };

    if (intervalMs === definition.defaultIntervalMs) {
      delete nextPolling[sourceId];
    } else {
      nextPolling[sourceId] = intervalMs;
    }

    updatePreferences({ polling: nextPolling });
  }

  return (
    <SettingsPageLayout
      title="Refresh"
      description="Control how often Radarboard refreshes widgets, plugins, and app surfaces."
      statusText={`${allSources.length} refresh sources registered`}
      searchPlaceholder="Search refresh sources..."
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      {filteredSources.length === 0 ? (
        <EmptyState message="No refresh sources match your search." />
      ) : (
        (Object.keys(CATEGORY_LABELS) as PollingCategory[]).map((category) => {
          const entries = groupedSources.get(category) ?? [];
          if (entries.length === 0) return null;

          return (
            <SettingsCardSection key={category} title={CATEGORY_LABELS[category]}>
              <SettingsGrid>
                {entries.map(({ sourceId, definition }) => {
                  const effectiveInterval = getEffectivePollingInterval(
                    sourceId,
                    preferences.polling
                  );
                  const hasOverride = preferences.polling?.[sourceId] !== undefined;

                  return (
                    <PollingSourceCard
                      key={sourceId}
                      sourceId={sourceId}
                      definition={definition}
                      effectiveInterval={effectiveInterval}
                      hasOverride={hasOverride}
                      onIntervalChange={(intervalMs) =>
                        updatePollingPreference(sourceId, intervalMs)
                      }
                      onReset={() =>
                        updatePollingPreference(sourceId, definition.defaultIntervalMs)
                      }
                    />
                  );
                })}
              </SettingsGrid>
            </SettingsCardSection>
          );
        })
      )}
    </SettingsPageLayout>
  );
}
