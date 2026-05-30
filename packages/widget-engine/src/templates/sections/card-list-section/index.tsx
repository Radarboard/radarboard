"use client";

import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import { Search } from "lucide-react";
import type React from "react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { TemplateItemProvider, useResolvedData, useResolvedSourceState } from "../../data-resolver";
import type { CardListSectionConfig, DataSource } from "../../types";
import { useTemplateFormatting } from "../../use-formatting";
import { formatValue } from "../../utils/format-value";
import { getByPath } from "../../utils/get-by-path";
import { encodeSelectionValue } from "../../utils/selection";

const CARD_SKELETON_KEYS = ["alpha", "beta", "gamma"] as const;

function getResponsiveGridStyle(config: CardListSectionConfig): React.CSSProperties {
  const minCardWidth = config.minCardWidth ?? 280;
  return {
    gridTemplateColumns: `repeat(auto-fit, minmax(${minCardWidth}px, 1fr))`,
  };
}

function getCardItemKey(item: unknown, index: number): string {
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;

    for (const key of ["id", "slug", "name", "path", "title"]) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) {
        return `${value}-${index}`;
      }
      if (typeof value === "number") {
        return `${value}-${index}`;
      }
    }
  }

  return `card-item-${index}`;
}

function readSearchValue(item: unknown, source?: DataSource): string {
  if (!source) return "";
  const value = getByPath(item, source.field);
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .join(" ")
      .toLowerCase();
  }
  return "";
}

function getSelectionValue(item: unknown, config: CardListSectionConfig): string | null {
  const selection = config.selection;
  if (!selection) return null;

  const key = getByPath(item, selection.keyField);
  if (key == null) return null;

  return encodeSelectionValue(selection.selectionId, String(key));
}

function matchesSearch(item: unknown, config: CardListSectionConfig, query: string): boolean {
  if (!query) return true;

  const haystack = [
    readSearchValue(item, config.titleSource),
    readSearchValue(item, config.subtitleSource),
    readSearchValue(item, config.descriptionSource),
    readSearchValue(item, config.badgeSource),
    readSearchValue(item, config.hrefSource),
    ...(config.meta ?? []).map((meta) => readSearchValue(item, meta.source)),
  ]
    .filter(Boolean)
    .join(" ");

  return haystack.includes(query);
}

function ResolvedCardValue({
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
  if (!source || value == null || value === "") return null;

  return (
    <span className={className} style={style}>
      {formatValue(value, source.format, {
        locale,
        normalize: source.normalize,
        timeZone,
      })}
    </span>
  );
}

function CardImage({
  image,
  title,
  subtitleSource,
}: {
  image: unknown;
  title: unknown;
  subtitleSource?: DataSource;
}) {
  if (typeof image === "string" && image.length > 0) {
    return (
      <div
        role="img"
        aria-label={`${String(title ?? "Bookmark")} preview`}
        className="block h-28 w-full bg-cover bg-top bg-no-repeat"
        style={{ backgroundImage: `url("${image}")` }}
      />
    );
  }

  return (
    <div
      className="flex h-28 w-full items-center justify-center px-4 text-center"
      style={{
        background:
          "radial-gradient(circle at top, var(--color-slate-800), var(--color-slate-900) 60%, var(--color-surface))",
      }}
    >
      <ResolvedCardValue
        source={subtitleSource}
        className="font-mono text-dim text-w-sm uppercase tracking-[0.16em]"
      />
    </div>
  );
}

function CardMeta({ meta }: { meta: NonNullable<CardListSectionConfig["meta"]> }) {
  if (meta.length === 0) return null;

  return (
    <div className="grid gap-2 border-border border-t pt-2 sm:grid-cols-2">
      {meta.map((m) => (
        <div key={m.label} className="min-w-0">
          <div className="font-mono text-dim text-w-sm uppercase tracking-[0.14em]">{m.label}</div>
          <ResolvedCardValue
            source={m.source}
            className="mt-1 block truncate font-mono text-muted-foreground text-w-sm"
          />
        </div>
      ))}
    </div>
  );
}

function ResolvedCardItem({
  config,
  selectionValue,
  onSelectedDetailIdChange,
}: {
  config: CardListSectionConfig;
  selectionValue: string | null;
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  const image = useResolvedData(config.imageSource);
  const href = useResolvedData(config.hrefSource);
  const resolvedTitle = useResolvedData(config.titleSource);

  const isInternalLink = typeof href === "string" && (href.startsWith("?") || href.startsWith("/"));

  const content = (
    <>
      <div className="overflow-hidden rounded-item border border-border bg-surface">
        <CardImage image={image} title={resolvedTitle} subtitleSource={config.subtitleSource} />
      </div>

      <div className="space-y-2 p-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-left">
            <ResolvedCardValue
              source={config.subtitleSource}
              className="block truncate font-mono text-dim text-w-sm uppercase tracking-[0.12em]"
            />
            <ResolvedCardValue
              source={config.titleSource}
              className="mt-1 line-clamp-2 block font-mono font-semibold text-foreground-secondary text-w-sm leading-snug"
            />
          </div>
          <ResolvedCardValue
            source={config.badgeSource}
            className="shrink-0 rounded-item border border-border bg-surface px-2 py-1 font-mono text-muted-foreground text-w-sm"
          />
        </div>

        <ResolvedCardValue
          source={config.descriptionSource}
          className="line-clamp-2 text-left font-mono text-dim text-w-sm leading-relaxed"
        />

        <CardMeta meta={config.meta ?? []} />
      </div>
    </>
  );

  const cardClassName =
    "group flex flex-col self-start overflow-hidden rounded-item border border-border bg-surface align-top transition-colors hover:border-border hover:bg-surface";

  if (selectionValue && onSelectedDetailIdChange) {
    return (
      <Button
        type="button"
        variant="ghost"
        uppercase={false}
        onClick={() => onSelectedDetailIdChange(selectionValue)}
        className={cn(cardClassName, "cursor-pointer")}
      >
        {content}
      </Button>
    );
  }

  if (typeof href === "string" && href.length > 0) {
    if (isInternalLink) {
      return (
        <Button
          type="button"
          variant="ghost"
          uppercase={false}
          onClick={() =>
            window.dispatchEvent(new CustomEvent("radarboard:navigate", { detail: href }))
          }
          className={cn(cardClassName, "cursor-pointer")}
        >
          {content}
        </Button>
      );
    }

    return (
      <a
        href={href}
        target={config.hrefTarget ?? "_blank"}
        rel="noopener noreferrer"
        className={cn(cardClassName, "cursor-pointer")}
      >
        {content}
      </a>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}

function CardListItem({
  config,
  item,
  onSelectedDetailIdChange,
}: {
  config: CardListSectionConfig;
  item: unknown;
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  return (
    <TemplateItemProvider item={item}>
      <ResolvedCardItem
        config={config}
        selectionValue={getSelectionValue(item, config)}
        onSelectedDetailIdChange={onSelectedDetailIdChange}
      />
    </TemplateItemProvider>
  );
}

export function CardListSection({
  config,
  onSelectedDetailIdChange,
}: {
  config: CardListSectionConfig;
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  const sourceState = useResolvedSourceState(config.source.sourceId);
  const resolved = useResolvedData(config.source, { disableItemContext: true });
  const rows = Array.isArray(resolved) ? resolved : [];
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matched = rows.filter((item) => matchesSearch(item, config, normalizedQuery));
    return typeof config.maxItems === "number" ? matched.slice(0, config.maxItems) : matched;
  }, [config, query, rows]);

  if (sourceState.loading && rows.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div
          className="scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-scroll"
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="grid gap-3 p-3" style={getResponsiveGridStyle(config)}>
            {CARD_SKELETON_KEYS.map((key) => (
              <div
                key={key}
                className="overflow-hidden rounded-item border border-border bg-surface-raised"
              >
                <div className="h-40 animate-pulse bg-secondary" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-24 animate-pulse bg-surface-raised" />
                  <div className="h-4 w-3/4 animate-pulse bg-secondary" />
                  <div className="h-10 animate-pulse bg-surface-raised" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {config.searchable ? (
        <div className="shrink-0 border-border border-b px-3 py-2.5">
          <div className="relative block">
            <Search className="icon-xs pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={config.filterPlaceholder ?? "Filter cards…"}
              variant="surface"
              size="lg"
              className="w-full pr-3 pl-9 font-mono text-w-sm"
            />
          </div>
        </div>
      ) : null}

      <div
        className="scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-scroll"
        style={{ scrollbarGutter: "stable" }}
      >
        {filteredRows.length === 0 ? (
          <EmptyState message={config.emptyMessage ?? "No cards"} variant="compact" />
        ) : (
          <div
            className="grid content-start items-start gap-2.5 p-3"
            style={getResponsiveGridStyle(config)}
          >
            {filteredRows.map((item, index) => (
              <CardListItem
                key={getCardItemKey(item, index)}
                config={config}
                item={item}
                onSelectedDetailIdChange={onSelectedDetailIdChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
