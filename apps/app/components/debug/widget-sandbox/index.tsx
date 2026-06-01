"use client";

import { Button } from "@radarboard/ui/button";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  synchronizeTemplateConfig,
  TemplateWidget,
} from "@radarboard/widget-engine/templates";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { createEmptyWidgetData, createMockWidgetData } from "@radarboard/widget-sdk/testing";
import type { WidgetTemplateConfig } from "@radarboard/widget-sdk/types";
import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// State-aware resolver factory
// ---------------------------------------------------------------------------

type PreviewState = "happy" | "empty" | "loading" | "error";

const PREVIEW_LABELS: Record<PreviewState, { label: string; color: string }> = {
  happy: { label: "Happy Path", color: "text-success" },
  empty: { label: "Empty", color: "text-warning" },
  loading: { label: "Loading", color: "text-accent" },
  error: { label: "Error", color: "text-destructive" },
};

function createStateResolver(data: unknown, state: PreviewState) {
  return function StateResolver({ onState }: DataSourceResolverProps) {
    useEffect(() => {
      switch (state) {
        case "happy":
          onState({
            data,
            fetchedAt: Date.now() / 1000,
            refetch: null,
            loading: false,
            error: null,
          });
          break;
        case "empty":
          onState({
            data,
            fetchedAt: Date.now() / 1000,
            refetch: null,
            loading: false,
            error: null,
          });
          break;
        case "loading":
          onState({
            data: null,
            fetchedAt: null,
            refetch: null,
            loading: true,
            error: null,
          });
          break;
        case "error":
          onState({
            data: null,
            fetchedAt: null,
            refetch: null,
            loading: false,
            error: "Connection failed — check your credentials",
          });
          break;
        default:
          break;
      }
    }, [onState]);

    return null;
  };
}

// ---------------------------------------------------------------------------
// Widget card preview
// ---------------------------------------------------------------------------

function PreviewFrame({ children, state }: { children: React.ReactNode; state: PreviewState }) {
  return (
    <div
      data-testid={`widget-preview-card-${state}`}
      className="flex h-[280px] min-h-[280px] min-w-0 overflow-hidden border border-border bg-surface-raised"
    >
      <div className="flex h-full min-h-0 w-full min-w-0 [&>*]:h-full [&>*]:min-h-0 [&>*]:w-full [&>*]:min-w-0">
        {children}
      </div>
    </div>
  );
}

function WidgetPreviewCard({
  widgetId,
  config,
  state,
}: {
  widgetId: string;
  config: WidgetTemplateConfig;
  state: PreviewState;
}) {
  // Register sandbox-specific data sources for this widget+state combo
  const sandboxSourcePrefix = `sandbox:${widgetId}:${state}`;

  const sandboxConfig = useMemo(() => {
    const mockData =
      state === "empty" ? createEmptyWidgetData(config) : createMockWidgetData(config, 5);

    // Remap data sources to sandbox-scoped IDs
    const remappedSources = (config.dataSources ?? []).map((ds) => ({
      ...ds,
      id: `${sandboxSourcePrefix}:${ds.id}`,
    }));

    // Register resolvers for each source
    for (const ds of config.dataSources ?? []) {
      const resolverKey = `${sandboxSourcePrefix}:${ds.id}`;
      const sourceData = mockData[ds.id] ?? {};
      registerTemplateDataSource(resolverKey, createStateResolver(sourceData, state));
    }

    // Create remapped section configs
    const remapSource = (sections: unknown): unknown => {
      if (!sections || typeof sections !== "object") return sections;
      if (Array.isArray(sections)) return sections.map(remapSource);

      const obj = sections as Record<string, unknown>;
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        if (key === "sourceId" && typeof value === "string") {
          result[key] = `${sandboxSourcePrefix}:${value}`;
        } else if (typeof value === "object" && value !== null) {
          result[key] = remapSource(value);
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    const remapped: WidgetTemplateConfig = {
      ...config,
      dataSources: remappedSources,
      sections: remapSource(config.sections) as WidgetTemplateConfig["sections"],
      expandedSections: config.expandedSections
        ? (remapSource(config.expandedSections) as WidgetTemplateConfig["expandedSections"])
        : undefined,
      recipe: config.recipe
        ? (remapSource(config.recipe) as WidgetTemplateConfig["recipe"])
        : undefined,
      expandedRecipe: config.expandedRecipe
        ? (remapSource(config.expandedRecipe) as WidgetTemplateConfig["expandedRecipe"])
        : undefined,
    };

    return synchronizeTemplateConfig(remapped);
  }, [config, state, sandboxSourcePrefix]);

  return (
    <PreviewFrame state={state}>
      <TemplateWidget
        widgetId={`sandbox:${widgetId}:${state}`}
        projectSlug={null}
        config={sandboxConfig}
      />
    </PreviewFrame>
  );
}

// ---------------------------------------------------------------------------
// Main sandbox
// ---------------------------------------------------------------------------

export function WidgetSandbox() {
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [selectedStates, setSelectedStates] = useState<Set<PreviewState>>(
    new Set(["happy", "empty", "loading", "error"])
  );

  const widgets = useMemo(() => {
    const entries: Array<{
      id: string;
      name: string;
      description: string;
      config: WidgetTemplateConfig | null;
    }> = [];

    for (const [id, descriptor] of WIDGET_REGISTRY) {
      const config = descriptor.defaultConfig as unknown as WidgetTemplateConfig | undefined;
      if (config?.sections || config?.recipe) {
        entries.push({
          id,
          name: descriptor.name,
          description: descriptor.description,
          config: config ?? null,
        });
      }
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const visibleWidgets = selectedWidget ? widgets.filter((w) => w.id === selectedWidget) : widgets;

  const toggleState = (state: PreviewState) => {
    setSelectedStates((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  };

  const states = Array.from(selectedStates) as PreviewState[];

  return (
    <div className="min-h-screen overflow-y-auto bg-background p-8 text-foreground-secondary">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <header className="space-y-2">
          <div className="font-mono text-dim text-w-sm uppercase tracking-[0.2em]">
            Widget Sandbox
          </div>
          <h1 className="font-semibold text-3xl text-foreground tracking-tight">
            Preview Widgets in All States
          </h1>
          <p className="max-w-3xl text-muted-foreground text-w-sm leading-relaxed">
            Every registered widget rendered with auto-generated mock data. Use this to verify
            layouts across happy path, empty, loading, and error states during development.
          </p>
        </header>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 border-border border-b pb-4">
          <label className="text-dim text-w-sm" htmlFor="sandbox-widget-select">
            Widget:
          </label>
          <select
            id="sandbox-widget-select"
            value={selectedWidget ?? "__all__"}
            onChange={(e) =>
              setSelectedWidget(e.target.value === "__all__" ? null : e.target.value)
            }
            className="rounded border border-input bg-surface px-2 py-1 text-foreground text-w-sm"
          >
            <option value="__all__">All widgets ({widgets.length})</option>
            {widgets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <span className="text-dim">|</span>
          <span className="text-dim text-w-sm">States:</span>
          {(
            Object.entries(PREVIEW_LABELS) as Array<
              [PreviewState, { label: string; color: string }]
            >
          ).map(([state, { label, color }]) => (
            <Button
              key={state}
              variant="outline"
              size="sm"
              onClick={() => toggleState(state)}
              className={`font-mono text-w-xs ${
                selectedStates.has(state) ? `bg-surface-raised ${color}` : "text-dim"
              }`}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Widget grid */}
        {visibleWidgets.map((widget) => (
          <section key={widget.id} className="space-y-3">
            <div>
              <h2 className="font-medium text-foreground text-lg">{widget.name}</h2>
              <p className="font-mono text-dim text-w-xs">{widget.id}</p>
              {widget.description && (
                <p className="mt-0.5 text-muted-foreground text-w-sm">{widget.description}</p>
              )}
            </div>

            <div
              data-testid={`widget-state-grid-${widget.id}`}
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${Math.min(states.length, 4)}, minmax(0, 1fr))`,
              }}
            >
              {states.map((state) => (
                <div key={state} className="min-w-0 space-y-1">
                  <div
                    className={`font-mono text-w-sm uppercase tracking-[0.16em] ${PREVIEW_LABELS[state].color}`}
                  >
                    {PREVIEW_LABELS[state].label}
                  </div>
                  {widget.config && (
                    <WidgetPreviewCard widgetId={widget.id} config={widget.config} state={state} />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        {visibleWidgets.length === 0 && (
          <div className="py-20 text-center text-dim">
            No template-backed widgets found in the registry.
          </div>
        )}
      </div>
    </div>
  );
}
