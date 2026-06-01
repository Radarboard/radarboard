"use client";

import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import type { PluginDescriptor, PresentationMode } from "@radarboard/plugin-sdk/types";
import { resolvePresentationConfig } from "@radarboard/plugin-sdk/types";
import { PluginAPIContext } from "@radarboard/plugin-sdk/use-plugin-api";
import { Button } from "@radarboard/ui/button";
import { ErrorBoundary } from "@radarboard/ui/error-boundary";
import { cn } from "@radarboard/utils/cn";
import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Preview state definitions
// ---------------------------------------------------------------------------

type PluginPreviewState = "loaded" | "empty" | "loading" | "error";

const PREVIEW_LABELS: Record<PluginPreviewState, { label: string; color: string }> = {
  loaded: { label: "Loaded", color: "text-success" },
  empty: { label: "Empty", color: "text-warning" },
  loading: { label: "Loading", color: "text-accent" },
  error: { label: "Error", color: "text-destructive" },
};

// ---------------------------------------------------------------------------
// Presentation mode containers
// ---------------------------------------------------------------------------

const PRESENTATION_STYLES: Record<PresentationMode, { className: string; label: string }> = {
  "side-panel": {
    className: "w-[400px] h-[600px]",
    label: "Side Panel (400x600)",
  },
  fullscreen: {
    className: "w-full h-[600px]",
    label: "Fullscreen",
  },
  modal: {
    className: "w-[560px] h-[400px] mx-auto",
    label: "Modal (560x400)",
  },
  "mini-hud": {
    className: "w-[320px] h-[200px]",
    label: "Mini HUD (320x200)",
  },
};

// ---------------------------------------------------------------------------
// Plugin preview card
// ---------------------------------------------------------------------------

function PluginPreviewCard({
  descriptor,
  state,
  presentation,
}: {
  descriptor: PluginDescriptor;
  state: PluginPreviewState;
  presentation: PresentationMode;
}) {
  const api = useMemo(() => {
    const store = new Map<string, string>();

    if (state === "loaded") {
      // Seed some mock data so the plugin has something to render
      store.set("item:1", JSON.stringify({ id: "1", title: "Sample item", createdAt: Date.now() }));
      store.set(
        "item:2",
        JSON.stringify({ id: "2", title: "Another item", createdAt: Date.now() - 86400000 })
      );
      store.set(
        "item:3",
        JSON.stringify({ id: "3", title: "Third item", createdAt: Date.now() - 172800000 })
      );
    }

    return createMockPluginAPI(descriptor.id, state === "empty" ? undefined : store);
  }, [descriptor.id, state]);

  const presStyle = PRESENTATION_STYLES[presentation];
  const Component = descriptor.component;

  if (state === "loading") {
    return (
      <div
        className={cn(
          presStyle.className,
          "flex items-center justify-center overflow-hidden rounded-item border border-border bg-surface"
        )}
      >
        <div className="space-y-3 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="font-mono text-dim text-w-sm">Loading plugin...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        className={cn(
          presStyle.className,
          "flex items-center justify-center overflow-hidden rounded-item border border-destructive/30 bg-surface"
        )}
      >
        <div className="space-y-2 px-4 text-center">
          <p className="font-mono text-destructive text-w-sm">Plugin Error</p>
          <p className="text-muted-foreground text-w-xs">
            An unrecoverable error occurred in the plugin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        presStyle.className,
        "overflow-hidden rounded-item border border-border bg-surface"
      )}
    >
      <ErrorBoundary title={descriptor.name} resetKeys={[descriptor.id, state, presentation]}>
        <PluginAPIContext.Provider value={api}>
          <Component api={api} />
        </PluginAPIContext.Provider>
      </ErrorBoundary>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main sandbox
// ---------------------------------------------------------------------------

export function PluginSandbox() {
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [selectedStates, setSelectedStates] = useState<Set<PluginPreviewState>>(
    new Set(["loaded", "empty", "loading", "error"])
  );
  const [presentation, setPresentation] = useState<PresentationMode>("side-panel");

  const plugins = useMemo(() => {
    return getAllPlugins().sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const visiblePlugins = selectedPlugin ? plugins.filter((p) => p.id === selectedPlugin) : plugins;

  const toggleState = (state: PluginPreviewState) => {
    setSelectedStates((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  };

  const states = Array.from(selectedStates) as PluginPreviewState[];

  return (
    <div className="min-h-screen overflow-y-auto bg-background p-8 text-foreground-secondary">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <header className="space-y-2">
          <div className="font-mono text-dim text-w-sm uppercase tracking-[0.2em]">
            Plugin Sandbox
          </div>
          <h1 className="font-semibold text-3xl text-foreground tracking-tight">
            Preview Plugins in All States
          </h1>
          <p className="max-w-3xl text-muted-foreground text-w-sm leading-relaxed">
            Every registered plugin rendered with a mock PluginAPI. Preview different states and
            presentation modes during development.
          </p>
        </header>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 border-border border-b pb-4">
          <label className="text-dim text-w-sm" htmlFor="sandbox-plugin-select">
            Plugin:
          </label>
          <select
            id="sandbox-plugin-select"
            value={selectedPlugin ?? "__all__"}
            onChange={(e) =>
              setSelectedPlugin(e.target.value === "__all__" ? null : e.target.value)
            }
            className="rounded border border-input bg-surface px-2 py-1 text-foreground text-w-sm"
          >
            <option value="__all__">All plugins ({plugins.length})</option>
            {plugins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <span className="text-dim">|</span>
          <span className="text-dim text-w-sm">States:</span>
          {(
            Object.entries(PREVIEW_LABELS) as Array<
              [PluginPreviewState, { label: string; color: string }]
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

          <span className="text-dim">|</span>
          <label className="text-dim text-w-sm" htmlFor="sandbox-presentation-select">
            Mode:
          </label>
          <select
            id="sandbox-presentation-select"
            value={presentation}
            onChange={(e) => setPresentation(e.target.value as PresentationMode)}
            className="rounded border border-input bg-surface px-2 py-1 text-foreground text-w-sm"
          >
            {(
              Object.entries(PRESENTATION_STYLES) as Array<[PresentationMode, { label: string }]>
            ).map(([mode, { label }]) => (
              <option key={mode} value={mode}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Plugin grid */}
        {visiblePlugins.map((plugin) => {
          const presConfig = resolvePresentationConfig(plugin);
          return (
            <section key={plugin.id} className="space-y-3">
              <div>
                <h2 className="font-medium text-foreground text-lg">{plugin.name}</h2>
                <p className="font-mono text-dim text-w-xs">
                  {plugin.id} &middot; v{plugin.version} &middot; default: {presConfig.default}
                </p>
                {plugin.description && (
                  <p className="mt-0.5 text-muted-foreground text-w-sm">{plugin.description}</p>
                )}
              </div>

              <div
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
                    <PluginPreviewCard
                      descriptor={plugin}
                      state={state}
                      presentation={presentation}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {visiblePlugins.length === 0 && (
          <div className="py-20 text-center text-dim">No plugins found in the registry.</div>
        )}
      </div>
    </div>
  );
}
