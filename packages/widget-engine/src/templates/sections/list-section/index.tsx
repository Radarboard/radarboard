"use client";

import { cn } from "@radarboard/utils/cn";
import type React from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  CompactProjectBadge,
  resolveCompactProjectBadgeLabel,
} from "../../../components/compact-project-badge";
import { InlineListHeader, InlineListRow } from "../../../components/inline-list-layout";
import { TemplateItemProvider, useResolvedData, useResolvedSourceState } from "../../data-resolver";
import type {
  DataSource,
  InlineListHeaderColumnConfig,
  ListSectionConfig,
  RowListBadgeConfig,
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
      return "#f59e0b";
    case "error":
    case "failed":
      return "#e05555";
    default:
      return "#666";
  }
}

function ListValue({
  source,
  className,
  style,
}: {
  source?: DataSource;
  className?: string;
  style?: CSSProperties;
}) {
  const { locale, timeZone } = useTemplateFormatting();
  const value = useResolvedData(source);
  const currency = useResolvedData(
    source?.format === "currency"
      ? {
          sourceId: source.sourceId,
          field: getSiblingCurrencyField(source.field),
        }
      : undefined
  );
  if (!source) return null;
  if (value == null || value === "") return null;

  return (
    <span className={className} style={style}>
      {formatValue(value, source.format, {
        currency: typeof currency === "string" ? currency : undefined,
        precision: source.precision,
        compact: source.compact,
        locale,
        normalize: source.normalize,
        timeZone,
      })}
    </span>
  );
}

function StatusDot({ source }: { source?: DataSource }) {
  const value = useResolvedData(source);
  if (!source) return null;
  if (value == null) return null;

  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: resolveStatusColor(value) }}
    />
  );
}

function getListItemKey(item: unknown, index: number): string {
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;

    for (const key of ["id", "slug", "name", "path", "title"]) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) {
        return `${value}-${index}`;
      }
    }
  }

  return `item-${index}`;
}

function ListBadge({ badge }: { badge?: RowListBadgeConfig }) {
  const label = useResolvedData(badge?.label);
  const color = useResolvedData(badge?.color);

  if (!badge || typeof label !== "string" || label.length === 0) return null;

  if (badge.normalize === "compact-project") {
    const normalizedLabel = resolveCompactProjectBadgeLabel(label);
    if (!normalizedLabel) return null;
    return (
      <CompactProjectBadge
        label={normalizedLabel}
        color={typeof color === "string" ? color : "#666"}
      />
    );
  }

  return (
    <span
      className="inline-flex max-w-full items-center rounded-item px-1.5 py-0.5 font-mono text-w-sm"
      style={{
        backgroundColor: typeof color === "string" ? `${color}20` : "#1a1a1a",
        color: typeof color === "string" ? color : "#888",
      }}
    >
      {label}
    </span>
  );
}

function getSelectionValue(item: unknown, config: ListSectionConfig): string | null {
  const selection = config.selection;
  if (!selection) return null;

  const key = getByPath(item, selection.keyField);
  if (key == null) return null;

  return encodeSelectionValue(selection.selectionId, String(key));
}

function getHref(item: unknown, config: ListSectionConfig): string | null {
  if (!config.hrefSource) return null;
  const href = getByPath(item, config.hrefSource.field);
  return typeof href === "string" && href.length > 0 ? href : null;
}

function getInlineGridTemplate(config: ListSectionConfig): string {
  if (config.inlineHeader?.gridTemplateColumns) {
    return config.inlineHeader.gridTemplateColumns;
  }

  const hasSubtitle = !!config.itemTemplate.subtitle;
  const hasValue = !!config.itemTemplate.value;
  const hasTimestamp = !!config.itemTemplate.timestamp;

  if (hasSubtitle && hasValue && hasTimestamp) {
    return "minmax(0,1fr) 140px 80px 90px";
  }
  if (hasSubtitle && hasValue) {
    return "minmax(0,1fr) 140px 80px";
  }
  if (hasValue && hasTimestamp) {
    return "minmax(0,1fr) 80px 90px";
  }
  if (hasSubtitle) {
    return "minmax(0,1fr) 140px";
  }
  if (hasValue || hasTimestamp) {
    return "minmax(0,1fr) auto";
  }

  return "minmax(0,1fr)";
}

type InlineSlot = "title" | "subtitle" | "value" | "timestamp";

function hasInlineSlot(config: ListSectionConfig, slot: InlineSlot): boolean {
  switch (slot) {
    case "title":
      return true;
    case "subtitle":
      return Boolean(config.itemTemplate.subtitle);
    case "value":
      return Boolean(config.itemTemplate.value);
    case "timestamp":
      return Boolean(config.itemTemplate.timestamp);
    default:
      return false;
  }
}

function getInlineColumns(
  config: ListSectionConfig
): Array<{ key: InlineSlot; label: string; align?: "left" | "right" | "center" }> {
  const explicitColumns = config.inlineHeader?.columns?.filter((column) =>
    hasInlineSlot(config, column.slot)
  );

  if (explicitColumns && explicitColumns.length > 0) {
    return explicitColumns.map((column) => ({
      key: column.slot,
      label: column.label,
      align: column.align,
    }));
  }

  const header = config.inlineHeader;
  return [
    { key: "title", label: header?.title ?? "Title" },
    config.itemTemplate.subtitle
      ? {
          key: "subtitle" as const,
          label: header?.subtitle ?? "Meta",
        }
      : null,
    config.itemTemplate.value
      ? {
          key: "value" as const,
          label: header?.value ?? "Value",
          align: "right" as const,
        }
      : null,
    config.itemTemplate.timestamp
      ? {
          key: "timestamp" as const,
          label: header?.timestamp ?? "Time",
          align: "right" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: InlineSlot;
    label: string;
    align?: "left" | "right" | "center";
  }>;
}

function TemplateInlineListHeader({ config }: { config: ListSectionConfig }) {
  if (!config.inlineHeader) return null;

  const columns = getInlineColumns(config);

  if (columns.length === 0) return null;

  return <InlineListHeader columns={columns} gridTemplateColumns={getInlineGridTemplate(config)} />;
}

function buildInlineCells(config: ListSectionConfig) {
  const cells = new Map<
    InlineListHeaderColumnConfig["slot"],
    {
      content: ReactNode;
      align?: "left" | "right" | "center";
    }
  >([
    [
      "title",
      {
        content: (
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot source={config.itemTemplate.status} />
            <div className="flex min-w-0 items-center gap-2">
              <ListValue
                source={config.itemTemplate.title}
                className="truncate font-mono text-foreground-secondary text-w-sm"
              />
              <ListBadge badge={config.itemTemplate.badge} />
            </div>
          </div>
        ),
      },
    ],
  ]);

  if (config.itemTemplate.subtitle) {
    cells.set("subtitle", {
      content: (
        <ListValue
          source={config.itemTemplate.subtitle}
          className="truncate font-mono text-dim text-w-sm"
        />
      ),
    });
  }

  if (config.itemTemplate.value) {
    cells.set("value", {
      content: (
        <ColoredListValue
          source={config.itemTemplate.value}
          colorSource={config.itemTemplate.valueColor}
          className="block font-mono text-muted-foreground text-w-sm"
        />
      ),
      align: "right",
    });
  }

  if (config.itemTemplate.timestamp) {
    cells.set("timestamp", {
      content: (
        <TimestampValue
          source={config.itemTemplate.timestamp}
          colorSource={config.itemTemplate.timestampColor}
        />
      ),
      align: "right",
    });
  }

  return getInlineColumns(config).flatMap((column) => {
    const cell = cells.get(column.key);
    if (!cell) return [];

    return [
      {
        key: column.key,
        content: cell.content,
        align: column.align ?? cell.align,
      },
    ];
  });
}

function TimestampValue({
  source,
  colorSource,
}: {
  source?: DataSource;
  colorSource?: DataSource;
}) {
  const color = useResolvedData(colorSource);

  return (
    <ListValue
      source={source}
      className="block font-mono text-w-sm"
      style={{ color: typeof color === "string" && color.length > 0 ? color : "#555" }}
    />
  );
}

function ColoredListValue({
  source,
  colorSource,
  className,
}: {
  source?: DataSource;
  colorSource?: DataSource;
  className?: string;
}) {
  const color = useResolvedData(colorSource);

  return (
    <ListValue
      source={source}
      className={className}
      style={{ color: typeof color === "string" && color.length > 0 ? color : undefined }}
    />
  );
}

function ListRow({
  config,
  item,
  onSelectedDetailIdChange,
}: {
  config: ListSectionConfig;
  item: unknown;
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  const selectionValue = getSelectionValue(item, config);
  const href = getHref(item, config);
  const isInline = (config.layout ?? "stacked") === "inline";
  const inlineGridTemplate = getInlineGridTemplate(config);

  const isInternalLink = href?.startsWith("?") || href?.startsWith("/");

  const getHandleAction = () => {
    if (selectionValue && onSelectedDetailIdChange) {
      return () => onSelectedDetailIdChange(selectionValue);
    }
    if (href) {
      if (isInternalLink) {
        return (e?: React.MouseEvent) => {
          e?.preventDefault();
          window.dispatchEvent(new CustomEvent("radarboard:navigate", { detail: href }));
        };
      }
      return () => window.open(href, config.hrefTarget ?? "_blank", "noopener,noreferrer");
    }
    return undefined;
  };
  const handleAction = getHandleAction();

  const content = isInline ? (
    <InlineListRow
      gridTemplateColumns={inlineGridTemplate}
      onClick={handleAction}
      cells={buildInlineCells(config)}
    />
  ) : (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusDot source={config.itemTemplate.status} />
          <div className="flex min-w-0 items-center gap-2">
            <ListValue
              source={config.itemTemplate.title}
              className="truncate font-mono text-foreground-secondary text-w-base"
            />
            <ListBadge badge={config.itemTemplate.badge} />
          </div>
        </div>
        <ListValue
          source={config.itemTemplate.subtitle}
          className="mt-1 block truncate font-mono text-dim text-w-sm"
        />
      </div>

      <div className="shrink-0 text-right">
        <ListValue
          source={config.itemTemplate.value}
          className="block font-mono text-muted-foreground text-w-sm"
        />
        <ListValue
          source={config.itemTemplate.timestamp}
          className="mt-1 block font-mono text-dim text-w-sm"
        />
      </div>
    </div>
  );

  return (
    <TemplateItemProvider item={item}>
      {selectionValue && onSelectedDetailIdChange && !isInline && (
        <button
          type="button"
          onClick={() => onSelectedDetailIdChange(selectionValue)}
          className="w-full cursor-pointer text-left transition-colors hover:bg-surface-raised"
        >
          {content}
        </button>
      )}
      {!(selectionValue && onSelectedDetailIdChange && !isInline) && href && !isInline && (
        <button
          type="button"
          onClick={handleAction}
          className="w-full cursor-pointer text-left transition-colors hover:bg-surface-raised"
        >
          {content}
        </button>
      )}
      {!(selectionValue && onSelectedDetailIdChange && !isInline) &&
        !(href && !isInline) &&
        content}
    </TemplateItemProvider>
  );
}

export function ListSection({
  config,
  onSelectedDetailIdChange,
}: {
  config: ListSectionConfig;
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  const sourceState = useResolvedSourceState(config.source.sourceId);
  const resolved = useResolvedData(config.source, { disableItemContext: true });
  const getItems = () => {
    if (!Array.isArray(resolved)) return [];
    if (config.maxItems != null) return resolved.slice(0, config.maxItems);
    return resolved;
  };
  const items = getItems();
  const isInline = (config.layout ?? "stacked") === "inline";

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
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      {isInline && <TemplateInlineListHeader config={config} />}
      <div className={cn("divide-y divide-[#111]", sourceState.error && "opacity-60")}>
        {items.map((item, index) => (
          <ListRow
            key={getListItemKey(item, index)}
            config={config}
            item={item}
            onSelectedDetailIdChange={onSelectedDetailIdChange}
          />
        ))}
      </div>
    </div>
  );
}
