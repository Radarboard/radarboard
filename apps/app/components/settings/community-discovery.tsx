"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type {
  ExtensionCatalogItem,
  ExtensionCatalogResponse,
  ExtensionCatalogType,
} from "@radarboard/types/extension";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { Download, ExternalLink, Puzzle } from "lucide-react";
import useSWR from "swr";
import { SettingsCatalogCard } from "./settings-catalog-card";
import { SettingsCardSection, SettingsGrid } from "./settings-page-layout";

const TYPE_LABELS: Record<ExtensionCatalogType, string> = {
  integration: "Integration",
  plugin: "Plugin",
  widget: "Widget",
};

async function fetchCatalog(url: string): Promise<ExtensionCatalogResponse> {
  const response = await fetch(url);
  const data = (await response.json()) as ExtensionCatalogResponse & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Could not load extension catalog.");
  }

  return data;
}

function matchesQuery(item: ExtensionCatalogItem, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  return [
    item.id,
    item.packageName ?? "",
    item.name,
    item.description,
    item.category ?? "",
    item.tier,
    ...item.tags,
    ...item.capabilities,
    ...item.requiredIntegrations,
  ]
    .join(" ")
    .toLowerCase()
    .includes(trimmed);
}

function CommunityExtensionCard({
  item,
  onInstall,
}: {
  item: ExtensionCatalogItem;
  onInstall: (installUrl: string) => void;
}) {
  const canInstall = item.installable && item.installUrl && !item.installed;
  const statusLabel = item.installed ? "installed" : item.tier;

  return (
    <SettingsCatalogCard
      enabled={!item.installed}
      title={item.name}
      titleMeta={TYPE_LABELS[item.type]}
      description={item.description}
      status={
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge variant={item.installed ? "secondary" : "outline"}>{statusLabel}</Badge>
          {item.category ? <Badge variant="secondary">{item.category}</Badge> : null}
          {item.sdkCompatibility ? (
            <Badge variant="secondary">{item.sdkCompatibility}</Badge>
          ) : null}
        </div>
      }
      icon={
        <span
          className={cn(
            "icon-sm inline-flex items-center justify-center rounded-item border border-border",
            item.installed ? "bg-muted text-muted-foreground" : "bg-secondary text-foreground"
          )}
          aria-hidden="true"
        >
          <Puzzle className="icon-xs" />
        </span>
      }
      badges={
        canInstall ? (
          <Button
            type="button"
            variant="outline"
            uppercase={false}
            onClick={() => onInstall(item.installUrl as string)}
            className="pointer-events-auto h-auto gap-1.5 rounded-item px-2 py-1 text-w-xs"
          >
            <Download className="icon-xs" />
            Install
          </Button>
        ) : item.repoUrl ? (
          <Button
            type="button"
            variant="ghost-link"
            uppercase={false}
            onClick={() => window.open(item.repoUrl, "_blank", "noopener,noreferrer")}
            className="pointer-events-auto h-auto gap-1.5 p-0 text-w-xs"
          >
            <ExternalLink className="icon-xs" />
            Repository
          </Button>
        ) : null
      }
    />
  );
}

export function CommunityExtensionDiscovery({
  type,
  searchQuery,
  onInstall,
}: {
  type: ExtensionCatalogType;
  searchQuery: string;
  onInstall: (installUrl: string) => void;
}) {
  const trimmedSearchQuery = searchQuery.trim();
  const { data, error, isLoading } = useSWR(
    trimmedSearchQuery ? API_ROUTES.extensionsCatalog : null,
    fetchCatalog,
    {
      revalidateOnFocus: false,
    }
  );

  if (!trimmedSearchQuery) return null;

  const items =
    data?.extensions
      .filter((item) => item.source === "community" && item.type === type)
      .filter((item) => matchesQuery(item, searchQuery))
      .slice(0, 12) ?? [];

  if (items.length === 0 && !error && !isLoading) return null;

  const title = `Community ${TYPE_LABELS[type].toLowerCase()}s`;
  const badge = isLoading ? "loading" : `${items.length} found`;

  return (
    <SettingsCardSection
      title={title}
      badge={
        <span className="rounded-item border border-border bg-card px-2 py-0.5 font-mono text-muted-foreground text-w-sm">
          {badge}
        </span>
      }
    >
      {error ? (
        <div className="rounded-item border border-border bg-surface p-4 text-muted-foreground text-w-sm">
          Community catalog is unavailable.
        </div>
      ) : null}

      {items.length > 0 ? (
        <SettingsGrid columns={3}>
          {items.map((item) => (
            <CommunityExtensionCard
              key={`${item.type}:${item.id}`}
              item={item}
              onInstall={onInstall}
            />
          ))}
        </SettingsGrid>
      ) : null}
    </SettingsCardSection>
  );
}
