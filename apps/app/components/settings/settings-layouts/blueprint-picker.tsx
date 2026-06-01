"use client";

import { getIntegration } from "@radarboard/integration-sdk";
import type { LayoutDefinition, UserProfile } from "@radarboard/types/database";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import type { LayoutBlueprintDescriptor } from "@radarboard/widget-engine/blueprints";
import {
  LAYOUT_BLUEPRINTS,
  scoreBlueprintFit,
} from "@radarboard/widget-engine/blueprints/registry";
import { getCellRect, getLayoutDimensions } from "@radarboard/widget-engine/layouts";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { canPlaceWidgetInScope, type DashboardScope } from "@radarboard/widget-sdk/dashboard-scope";
import { RemoteServiceIcon } from "@/components/shared/remote-service-icon";
import { getServiceFaviconUrl } from "@/lib/service-favicons";

// ---------------------------------------------------------------------------
// BlueprintCardPreview — grid preview with widget labels overlaid
// ---------------------------------------------------------------------------

/** Short display labels for widget IDs that fit in small grid cells. */
const WIDGET_SHORT_LABELS: Record<string, string> = {
  analytics: "Analytics",
  "aso-keywords": "ASO",
  builds: "Builds",
  "github-commits": "GitHub Commits",
  deployments: "Deploys",
  "vercel-domains": "Vercel Domains",
  "npm-downloads": "npm Downloads",
  logs: "Logs",
  observability: "Service Monitor",
  projects: "Projects",
  pulls: "PRs",
  bookmarks: "Bookmarks",
  revenue: "Revenue",
  "app-reviews": "App Reviews",
  roadmap: "Roadmap",
  seo: "SEO",
  shipping: "Release Activity",
  sponsorship: "Sponsors",
  "github-stars": "GitHub Stars",
};

/**
 * Build a position-based lookup for slot info.
 * When layouts are adapted to different column counts, cell IDs change
 * but row/col positions are preserved — so we match by position.
 */
function buildSlotPositionMap(
  blueprint: LayoutBlueprintDescriptor
): Map<string, { widgetId: string; purpose: string }> {
  const map = new Map<string, { widgetId: string; purpose: string }>();
  for (const slot of blueprint.slots) {
    const cell = blueprint.layout.cells.find((c) => c.id === slot.cellId);
    if (cell) {
      map.set(`${cell.rowStart},${cell.colStart}`, {
        widgetId: slot.widgetId,
        purpose: slot.purpose,
      });
    }
  }
  return map;
}

function BlueprintCardPreview({
  blueprint,
  adaptedLayout,
  dashboardScope,
}: {
  blueprint: LayoutBlueprintDescriptor;
  adaptedLayout: LayoutDefinition;
  dashboardScope?: DashboardScope;
}) {
  const { rowCount, colCount } = getLayoutDimensions(adaptedLayout);
  const slotMap = buildSlotPositionMap(blueprint);

  return (
    <div className="relative aspect-[1.35/1] w-full rounded-item border border-border bg-secondary">
      {adaptedLayout.cells.map((cell) => {
        const rect = getCellRect(adaptedLayout, cell);
        const needsRightGap = cell.colStart + cell.colSpan < colCount;
        const needsBottomGap = cell.rowStart + cell.rowSpan < rowCount;
        const slotInfo = slotMap.get(`${cell.rowStart},${cell.colStart}`);
        const descriptor = slotInfo ? WIDGET_REGISTRY.get(slotInfo.widgetId) : null;
        const isAllowed =
          !dashboardScope ||
          (descriptor ? canPlaceWidgetInScope(descriptor, dashboardScope) : true);
        const label = slotInfo
          ? isAllowed
            ? (WIDGET_SHORT_LABELS[slotInfo.widgetId] ?? slotInfo.widgetId)
            : undefined
          : undefined;
        const tooltip = slotInfo
          ? `${WIDGET_SHORT_LABELS[slotInfo.widgetId] ?? slotInfo.widgetId} — ${slotInfo.purpose}`
          : "Empty cell";

        return (
          <div
            key={cell.id}
            title={tooltip}
            className="absolute flex items-center justify-center border border-foreground/40 bg-foreground/[0.15]"
            style={{
              left: `${rect.leftPct}%`,
              top: `${rect.topPct}%`,
              width: needsRightGap ? `calc(${rect.widthPct}% - 1px)` : `${rect.widthPct}%`,
              height: needsBottomGap ? `calc(${rect.heightPct}% - 1px)` : `${rect.heightPct}%`,
            }}
          >
            {label ? (
              <span className="truncate px-0.5 font-mono text-foreground/50 text-w-xs leading-none">
                {label}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlueprintCard
// ---------------------------------------------------------------------------

function BlueprintCard({
  blueprint,
  adaptedLayout,
  isRecommended,
  isSelected,
  missingIntegrations,
  onSelect,
  dashboardScope,
}: {
  blueprint: LayoutBlueprintDescriptor;
  adaptedLayout: LayoutDefinition;
  isRecommended: boolean;
  isSelected: boolean;
  missingIntegrations: string[];
  onSelect: () => void;
  dashboardScope?: DashboardScope;
}) {
  const missingSet = new Set(missingIntegrations);
  const visibleSlotCount = dashboardScope
    ? blueprint.slots.filter((slot) => {
        const descriptor = WIDGET_REGISTRY.get(slot.widgetId);
        return descriptor ? canPlaceWidgetInScope(descriptor, dashboardScope) : true;
      }).length
    : blueprint.slots.length;

  return (
    <Button
      type="button"
      variant="ghost"
      spacing="none"
      uppercase={false}
      fullWidth
      onClick={onSelect}
      className={cn(
        "group flex h-auto flex-col items-stretch justify-start overflow-hidden whitespace-normal rounded-item border border-border bg-surface text-left transition-colors",
        "hover:border-accent hover:bg-surface-raised",
        isSelected && "border-accent bg-surface-raised ring-2 ring-accent ring-inset",
        !isSelected && isRecommended && "ring-1 ring-accent/30 ring-inset"
      )}
    >
      <div className="w-full p-3">
        <BlueprintCardPreview
          blueprint={blueprint}
          adaptedLayout={adaptedLayout}
          dashboardScope={dashboardScope}
        />
      </div>
      <div className="flex w-full flex-1 flex-col gap-1.5 border-border border-t px-3 py-2.5">
        <span className="truncate font-mono text-foreground text-w-sm">{blueprint.name}</span>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="default" size="xs">
            {visibleSlotCount} widgets
          </Badge>
          {isRecommended ? (
            <Badge variant="accent" size="xs">
              For you
            </Badge>
          ) : null}
          <TooltipProvider delayDuration={200}>
            {blueprint.requiredIntegrations.map((id) => {
              const descriptor = getIntegration(id);
              const label = descriptor?.name ?? id;
              const isMissing = missingSet.has(id);
              const faviconUrl = getServiceFaviconUrl(
                descriptor?.homepage ?? descriptor?.auth.docsUrl,
                32
              );
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                        isMissing
                          ? "border-warning/30 bg-warning/10"
                          : "border-border bg-surface-raised"
                      )}
                    >
                      <RemoteServiceIcon
                        src={faviconUrl}
                        alt={label}
                        size={14}
                        className={cn("rounded-full border-0", isMissing && "opacity-60")}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-mono text-w-xs">
                    {isMissing ? `Needs ${label}` : label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
        <p className="line-clamp-2 font-mono text-dim text-w-xs leading-relaxed">
          {blueprint.description}
        </p>
      </div>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// BlueprintGrid
// ---------------------------------------------------------------------------

interface BlueprintGridProps {
  personas: UserProfile[];
  connectedIntegrations: string[];
  /** Adapt blueprint layouts to this column count. */
  adaptLayout?: (layout: LayoutDefinition) => LayoutDefinition;
  onSelect: (blueprint: LayoutBlueprintDescriptor) => void;
  /** Currently selected blueprint ID (for visual highlight). */
  selectedId?: string | null;
  /** Target dashboard scope for hiding widgets that cannot be placed there. */
  dashboardScope?: DashboardScope;
}

export function BlueprintGrid({
  personas,
  connectedIntegrations,
  adaptLayout,
  onSelect,
  selectedId,
  dashboardScope,
}: BlueprintGridProps) {
  const scored = LAYOUT_BLUEPRINTS.map((blueprint) => {
    const score = scoreBlueprintFit(blueprint, {
      personas,
      connectedIntegrations,
      dashboardScope,
      canPlaceWidget: (widgetId, scope) => {
        const descriptor = WIDGET_REGISTRY.get(widgetId);
        return descriptor ? canPlaceWidgetInScope(descriptor, scope) : true;
      },
    });
    const missing = blueprint.requiredIntegrations.filter(
      (i) => !connectedIntegrations.includes(i)
    );
    return { blueprint, score, missing };
  }).sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {scored.map(({ blueprint, score, missing }) => {
        const adapted = adaptLayout ? adaptLayout(blueprint.layout) : blueprint.layout;
        return (
          <BlueprintCard
            key={blueprint.id}
            blueprint={blueprint}
            adaptedLayout={adapted}
            isRecommended={score > 0 && score === topScore}
            isSelected={selectedId === blueprint.id}
            missingIntegrations={missing}
            onSelect={() => onSelect(blueprint)}
            dashboardScope={dashboardScope}
          />
        );
      })}
    </div>
  );
}
