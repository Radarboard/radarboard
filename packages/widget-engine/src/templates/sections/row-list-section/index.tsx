"use client";

import { InfoRow } from "@radarboard/ui/info-row";
import { cn } from "@radarboard/utils/cn";
import { AlertTriangle, Bug, CircleAlert, GitPullRequest, Info, OctagonAlert } from "lucide-react";
import type React from "react";
import {
  CompactProjectBadge,
  resolveCompactProjectBadgeLabel,
} from "../../../components/compact-project-badge";
import { TemplateItemProvider, useResolvedData, useResolvedSourceState } from "../../data-resolver";
import type {
  DataSource,
  RowListBadgeConfig,
  RowListSectionConfig,
  RowListStatusConfig,
} from "../../types";
import { useTemplateFormatting } from "../../use-formatting";
import { formatValue, getSiblingCurrencyField } from "../../utils/format-value";
import { getByPath } from "../../utils/get-by-path";
import { encodeSelectionValue } from "../../utils/selection";

const SKELETON_KEYS = ["alpha", "beta", "gamma"] as const;

function resolveStatusColor(value: unknown): string {
  if (typeof value !== "string") return "#444";
  if (value.startsWith("#")) return value;

  switch (value.toLowerCase()) {
    case "ok":
    case "healthy":
    case "success":
    case "active":
      return "#4ade80";
    case "warning":
    case "pending":
    case "warn":
      return "#f59e0b";
    case "error":
    case "failed":
    case "fatal":
      return "#e05555";
    case "info":
      return "#5b8af5";
    default:
      return "#666";
  }
}

function getSeverityIcon(level: string) {
  switch (level) {
    case "fatal":
      return OctagonAlert;
    case "error":
      return CircleAlert;
    case "warning":
    case "warn":
      return AlertTriangle;
    case "info":
      return Info;
    default:
      return Bug;
  }
}

function getNamedIcon(level: string) {
  switch (level) {
    case "pull-request":
      return GitPullRequest;
    case "issue":
      return CircleAlert;
    default:
      return Bug;
  }
}

function getSeverityClass(level: string) {
  return cn(
    "inline-flex icon-base items-center justify-center rounded-item",
    level === "fatal" && "bg-destructive/20 text-destructive",
    level === "error" && "bg-destructive/10 text-destructive",
    (level === "warning" || level === "warn") && "bg-warning/10 text-warning",
    level === "info" && "bg-accent/10 text-accent",
    level === "debug" && "bg-dim/10 text-dim"
  );
}

function ResolvedTextValue({ source, className }: { source?: DataSource; className?: string }) {
  const { locale, timeZone } = useTemplateFormatting();
  const value = useResolvedData(source);
  const currency = useResolvedData(
    source?.format === "currency"
      ? { sourceId: source.sourceId, field: getSiblingCurrencyField(source.field) }
      : undefined
  );

  if (!source || value == null || value === "") return null;

  return (
    <span className={className}>
      {formatValue(value, source.format, {
        currency: typeof currency === "string" ? currency : undefined,
        locale,
        normalize: source.normalize,
        timeZone,
      })}
    </span>
  );
}

function FaviconImage({ url }: { url: string }) {
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/90 p-px">
      <span
        aria-hidden="true"
        className="h-full w-full rounded-full bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: `url("${url}")` }}
      />
    </span>
  );
}

function StatusIndicator({ config }: { config?: RowListStatusConfig }) {
  const value = useResolvedData(config?.source);
  if (!config || value == null) return null;

  if (config.display === "favicon" && typeof value === "string" && value.length > 0) {
    return <FaviconImage url={value} />;
  }

  if (config.display === "severity-icon" && typeof value === "string") {
    const Icon = getSeverityIcon(value);

    return (
      <span title={String(value)} className={getSeverityClass(value)}>
        <Icon className="icon-xs" aria-hidden="true" />
      </span>
    );
  }

  if (config.display === "named-icon" && typeof value === "string") {
    const Icon = getNamedIcon(value);
    return <Icon className="icon-xs" style={{ color: resolveStatusColor(value) }} />;
  }

  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: resolveStatusColor(value) }}
    />
  );
}

function RowListBadge({ config }: { config?: RowListBadgeConfig }) {
  const label = useResolvedData(config?.label);
  const color = useResolvedData(config?.color);
  if (!config || typeof label !== "string" || label.length === 0) return null;

  const normalizedLabel =
    config.normalize === "compact-project" ? resolveCompactProjectBadgeLabel(label) : label;
  if (!normalizedLabel) return null;

  if (typeof color !== "string" || color.length === 0) {
    return <span className="font-mono text-dim text-w-sm">{normalizedLabel}</span>;
  }

  return <CompactProjectBadge color={color} label={normalizedLabel} />;
}

function useResolvedColor(source?: DataSource): string | null {
  const value = useResolvedData(source);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getRowItemKey(item: unknown, index: number): string {
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    for (const key of ["id", "slug", "name", "path", "title"]) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  }

  return `row-item-${index}`;
}

function getSelectionValue(item: unknown, config: RowListSectionConfig): string | null {
  const selection = config.selection;
  if (!selection) return null;

  const key = getByPath(item, selection.keyField);
  if (key == null) return null;

  return encodeSelectionValue(selection.selectionId, String(key));
}

function useResolvedHref(source?: DataSource) {
  const value = useResolvedData(source);
  if (!source || typeof value !== "string" || value.length === 0) return null;
  return value;
}

function ResolvedRowListItem({
  config,
  selectionValue,
  onSelectedDetailIdChange,
}: {
  config: RowListSectionConfig;
  selectionValue: string | null;
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  const href = useResolvedHref(config.hrefSource);
  const timestampColor = useResolvedColor(config.itemTemplate.timestampColor);

  const isInternalLink = href?.startsWith("?") || href?.startsWith("/");

  let props: Record<string, unknown> = {};
  if (selectionValue && onSelectedDetailIdChange) {
    props = { onClick: () => onSelectedDetailIdChange(selectionValue) };
  } else if (href) {
    if (isInternalLink) {
      props = {
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("radarboard:navigate", { detail: href }));
        },
      };
    } else {
      props = {
        href,
        target: config.hrefTarget ?? "_blank",
        rel: "noopener noreferrer",
      };
    }
  }

  const subtitleEnd = timestampColor ? (
    <span style={{ color: timestampColor }}>
      <ResolvedTextValue source={config.itemTemplate.timestamp} className="font-mono text-w-sm" />
    </span>
  ) : (
    <ResolvedTextValue source={config.itemTemplate.timestamp} className="font-mono text-w-sm" />
  );

  return (
    <InfoRow
      {...props}
      density="compact"
      className="py-1.5"
      subtitleClassName="mt-0.5"
      leading={<StatusIndicator config={config.itemTemplate.status} />}
      title={<ResolvedTextValue source={config.itemTemplate.title} />}
      subtitleStart={
        <>
          <RowListBadge config={config.itemTemplate.badge} />
          <ResolvedTextValue
            source={config.itemTemplate.subtitle}
            className="truncate font-mono text-dim text-w-sm"
          />
        </>
      }
      subtitleEnd={subtitleEnd}
      subtitleEndClassName={timestampColor ? undefined : "text-dim"}
      trailing={
        <ResolvedTextValue
          source={config.itemTemplate.value}
          className="font-mono text-dim text-w-sm"
        />
      }
    />
  );
}

function RowListItem({
  config,
  item,
  onSelectedDetailIdChange,
}: {
  config: RowListSectionConfig;
  item: unknown;
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  return (
    <TemplateItemProvider item={item}>
      <ResolvedRowListItem
        config={config}
        selectionValue={getSelectionValue(item, config)}
        onSelectedDetailIdChange={onSelectedDetailIdChange}
      />
    </TemplateItemProvider>
  );
}

export function RowListSection({
  config,
  onSelectedDetailIdChange,
}: {
  config: RowListSectionConfig;
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  const sourceState = useResolvedSourceState(config.source.sourceId);
  const resolved = useResolvedData(config.source, { disableItemContext: true });
  const items = Array.isArray(resolved) ? resolved.slice(0, config.maxItems) : [];

  if (sourceState.loading && items.length === 0) {
    return (
      <div className="border-border border-t">
        {SKELETON_KEYS.map((key) => (
          <div key={key} className="border-border border-b px-3 py-2.5">
            <div className="icon-xs2 animate-pulse bg-secondary" />
            <div className="mt-2 h-2.5 w-20 animate-pulse bg-surface-raised" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-widget-sm items-center justify-center px-3 text-center font-mono text-dim text-w-sm">
        {config.emptyMessage ?? "No items"}
      </div>
    );
  }

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div className={cn("divide-y divide-[#111]", sourceState.error && "opacity-60")}>
        {items.map((item, index) => (
          <RowListItem
            key={getRowItemKey(item, index)}
            config={config}
            item={item}
            onSelectedDetailIdChange={onSelectedDetailIdChange}
          />
        ))}
      </div>
    </div>
  );
}
