"use client";

import { integrationRoute } from "@radarboard/integration-sdk/routes";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import type { WidgetDescriptor } from "@radarboard/widget-engine/widgets/registry";
import { LayoutTemplate } from "lucide-react";
import { createElement, useMemo, useState } from "react";
import useSWR from "swr";

interface NpmPreviewData {
  packages: Array<{
    name: string;
    version: string;
    weeklyDownloads: number;
  }>;
  totalWeekly: number;
}

export const PREVIEW_DIMENSIONS = {
  compact: { scale: 0.82, heightClassName: "h-[340px]" },
  expanded: { scale: 0.72, heightClassName: "h-[440px]" },
} as const;

function buildNpmPreviewUrl(config: Record<string, unknown>): string {
  const params = new URLSearchParams();
  const includePackages = Array.isArray(config.includePackages) ? config.includePackages : [];
  const excludePackages = Array.isArray(config.excludePackages) ? config.excludePackages : [];

  for (const item of includePackages) {
    if (typeof item === "string" && item.trim().length > 0) params.append("include", item);
  }

  for (const item of excludePackages) {
    if (typeof item === "string" && item.trim().length > 0) params.append("exclude", item);
  }

  return params.size > 0
    ? `${integrationRoute("npm", "data")}?${params.toString()}`
    : integrationRoute("npm", "data");
}

async function fetchPreviewJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Preview request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function NpmPreviewSurface({ config }: { config: Record<string, unknown> }) {
  const requestUrl = useMemo(() => buildNpmPreviewUrl(config), [config]);
  const { data } = useSWR<NpmPreviewData>(requestUrl, fetchPreviewJson, { refreshInterval: 0 });

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="grid shrink-0 grid-cols-1 gap-px bg-border">
        <div className="bg-surface-raised px-4 py-3">
          <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
            Weekly Downloads
          </div>
          <div className="mt-0.5 font-mono text-foreground-secondary text-w-xl">
            {data?.totalWeekly ?? 0}
          </div>
        </div>
      </div>
      <div className="h-[calc(100%-57px)] overflow-auto bg-surface">
        {data && data.packages.length > 0 ? (
          <div className="divide-y divide-border">
            {data.packages.map((pkg) => (
              <div
                key={pkg.name}
                className="grid grid-cols-[minmax(0,1fr)_88px_72px] gap-3 px-4 py-2 font-mono text-foreground-secondary text-w-sm"
              >
                <span className="truncate">{pkg.name}</span>
                <span className="text-right text-dim">v{pkg.version}</span>
                <span className="text-right">{pkg.weeklyDownloads}/w</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-dim text-w-sm">
            No packages
          </div>
        )}
      </div>
    </div>
  );
}

export function WidgetVisualEditorPreview({
  descriptor,
  activeProjectSlug,
  previewDirty,
  appliedPreviewConfig,
  appliedPreviewConfigKey,
  appliedWidgetConfig,
  appliedWidgetConfigKey,
  baseConfig,
  onApplyPreview,
}: {
  descriptor: WidgetDescriptor;
  activeProjectSlug: string | null;
  previewDirty: boolean;
  appliedPreviewConfig: Record<string, unknown> | null;
  appliedPreviewConfigKey: string | null;
  appliedWidgetConfig: Record<string, unknown> | null;
  appliedWidgetConfigKey: string | null;
  baseConfig: Record<string, unknown>;
  onApplyPreview: () => void;
}) {
  const [previewMode, setPreviewMode] = useState<"compact" | "expanded">("compact");
  const previewFrame = PREVIEW_DIMENSIONS[previewMode];
  const previewScale = previewFrame.scale;
  const previewComponent =
    previewMode === "compact"
      ? descriptor.component
      : (descriptor.expandedComponent ?? descriptor.component);

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
          <LayoutTemplate className="icon-xs" />
          Preview
        </div>
        <div className="flex items-center gap-2">
          {Boolean(previewDirty) && (
            <Button
              type="button"
              variant="outline"
              onClick={onApplyPreview}
              className="uppercase-none h-auto border-accent/30 px-2 py-1 font-mono text-accent text-w-sm uppercase tracking-wider hover:bg-accent/10 hover:text-accent"
            >
              Update Preview
            </Button>
          )}
          <div className="flex items-center gap-1 rounded-item border border-border bg-surface-raised p-1">
            {(["compact", "expanded"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                variant="ghost"
                onClick={() => setPreviewMode(mode)}
                className={cn(
                  "h-auto rounded-item px-2 py-1 font-mono font-normal text-w-sm uppercase tracking-wider transition-colors",
                  previewMode === mode
                    ? "bg-secondary text-foreground"
                    : "text-dim hover:bg-muted hover:text-foreground-secondary"
                )}
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {Boolean(previewDirty) && (
        <div className="rounded-item border border-border border-dashed bg-surface px-3 py-2 font-mono text-dim text-w-sm">
          Preview is out of date. Apply your changes when you are ready.
        </div>
      )}

      <div
        className={cn(
          "relative overflow-hidden rounded-item border border-border bg-background",
          previewFrame.heightClassName
        )}
      >
        <div className="absolute inset-0 overflow-hidden p-4">
          <div
            className="origin-top-left overflow-hidden rounded-item border border-border bg-background shadow-glow"
            style={{
              width: `${100 / previewScale}%`,
              height: `${100 / previewScale}%`,
              transform: `scale(${previewScale})`,
            }}
          >
            {descriptor.id === "npm-downloads" ? (
              <div
                key={`${previewMode}:${appliedWidgetConfigKey ?? "empty"}`}
                className="pointer-events-none h-full w-full overflow-hidden"
              >
                <NpmPreviewSurface
                  config={(appliedWidgetConfig ?? baseConfig) as Record<string, unknown>}
                />
              </div>
            ) : (
              <div
                key={`${previewMode}:${appliedPreviewConfigKey ?? "empty"}`}
                className="pointer-events-none h-full w-full overflow-hidden"
              >
                {Boolean(appliedPreviewConfig) &&
                  createElement(
                    previewComponent as unknown as React.ComponentType<Record<string, unknown>>,
                    {
                      widgetId: descriptor.id,
                      projectSlug: activeProjectSlug,
                      config: appliedPreviewConfig,
                    }
                  )}
              </div>
            )}
          </div>
        </div>

        {descriptor.id !== "npm-downloads" && !appliedPreviewConfig ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-6 text-center">
            <LayoutTemplate className="icon-base text-dim" />
            <p className="font-mono text-foreground-secondary text-w-sm">
              Live preview appears here
            </p>
            <p className="max-w-[280px] text-muted-foreground text-w-sm">
              Pick a layout recipe above and map your fields — this updates as you go. Connect the
              integration to see real data.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
