"use client";

import {
  FormField,
  FormInput,
  PluginFormDialog,
} from "@radarboard/plugin-sdk/components/form-dialog";
import { PluginListHeader } from "@radarboard/plugin-sdk/components/list-header";
import { PluginEmptyState } from "@radarboard/plugin-sdk/components/plugin-empty";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { Button } from "@radarboard/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radarboard/ui/tabs";
import { cn } from "@radarboard/utils/cn";
import { Bell, BellOff, Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { ServiceStatus, StatusSource, StatusSourceKind } from "../types";
import { useStatusPage } from "../use-status-page";

const STATUS_COLORS: Record<ServiceStatus, string> = {
  operational: "bg-emerald-400",
  degraded: "bg-amber-400",
  outage: "bg-red-400",
  unknown: "bg-dim",
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
  unknown: "Unknown",
};

const MONITOR_STATUS_ORDER: ServiceStatus[] = ["outage", "degraded", "unknown"];
const SOURCE_KIND_ORDER: StatusSourceKind[] = ["project", "standalone", "integration"];
const MONITOR_SECTION_TITLES: Record<ServiceStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outages",
  unknown: "Unknown",
};

const SOURCE_KIND_SECTION_TITLES: Record<StatusSourceKind, string> = {
  project: "Project Health",
  standalone: "Manual Sources",
  integration: "Linked Integrations",
};

const SOURCE_KIND_BADGES: Record<StatusSourceKind, string> = {
  project: "Project",
  standalone: "Manual",
  integration: "Linked",
};

type OverlayTab = "monitor" | "sources";

function getOverallStatusColor(sources: { status: ServiceStatus }[]): string {
  if (sources.length === 0) return "text-dim";
  if (sources.some((source) => source.status === "outage")) return "text-red-400";
  if (sources.some((source) => source.status === "degraded")) return "text-amber-400";
  if (sources.every((source) => source.status === "operational")) return "text-emerald-400";
  return "text-dim";
}

function getStatusTextColor(status: ServiceStatus): string {
  switch (status) {
    case "operational":
      return "text-emerald-400";
    case "degraded":
      return "text-amber-400";
    case "outage":
      return "text-red-400";
    default:
      return "text-dim";
  }
}

function sortSourcesByName(sources: StatusSource[]): StatusSource[] {
  return [...sources].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
  );
}

function formatCheckedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSourceKindBadgeLabel(kind: StatusSourceKind): string {
  return SOURCE_KIND_BADGES[kind];
}

function getSourceLink(source: StatusSource): string | null {
  return source.statusPageUrl ?? source.url ?? null;
}

function getSourceContext(source: StatusSource): string {
  if (source.kind === "integration") {
    return source.linkedTargetSummary ?? source.url;
  }

  return source.url;
}

function getMonitorSecondaryText(source: StatusSource): string {
  const checkedAt = formatCheckedAt(source.lastCheckedAt);

  return [
    getSourceKindBadgeLabel(source.kind),
    getSourceContext(source),
    checkedAt ? `checked ${checkedAt}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function getInventorySecondaryText(source: StatusSource): string {
  const checkedAt = formatCheckedAt(source.lastCheckedAt);

  return [
    getSourceContext(source),
    checkedAt ? `checked ${checkedAt}` : null,
    source.muted ? "alerts muted" : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function sourceMatchesSearch(source: StatusSource, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    source.name,
    source.url,
    source.statusPageUrl,
    source.linkedTargetSummary,
    SOURCE_KIND_SECTION_TITLES[source.kind],
    SOURCE_KIND_BADGES[source.kind],
    STATUS_LABELS[source.status],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function getSourceFaviconUrl(source: StatusSource): string | null {
  const targetUrl = getSourceLink(source);
  if (!targetUrl) return null;

  try {
    const { hostname } = new URL(targetUrl);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
  } catch {
    return null;
  }
}

function SourceAvatar({ source }: { source: StatusSource }) {
  const faviconUrl = getSourceFaviconUrl(source);

  return (
    <div className="relative shrink-0">
      {faviconUrl ? (
        <span
          role="img"
          aria-label={`${source.name} favicon`}
          className="icon-sm block rounded-item bg-center bg-cover bg-no-repeat"
          style={{ backgroundImage: `url("${faviconUrl}")` }}
        />
      ) : (
        <span className="icon-sm flex items-center justify-center rounded-item bg-secondary font-mono text-muted-foreground text-w-sm">
          {source.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span
        className={cn(
          "absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border border-border",
          STATUS_COLORS[source.status]
        )}
        title={STATUS_LABELS[source.status]}
      />
    </div>
  );
}

function SourceStatusText({ status }: { status: ServiceStatus }) {
  return (
    <span
      className={cn("w-[92px] shrink-0 text-right font-mono text-xs", getStatusTextColor(status))}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function SourceRowButton({
  source,
  children,
}: {
  source: StatusSource;
  children: React.ReactNode;
}) {
  const targetUrl = getSourceLink(source);

  function handleOpen() {
    if (!targetUrl) return;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      uppercase={false}
      fullWidth
      className={cn(
        "h-auto min-w-0 flex-1 justify-start gap-3 p-0 text-left hover:bg-transparent",
        targetUrl ? "cursor-pointer" : "cursor-default"
      )}
      onClick={targetUrl ? handleOpen : undefined}
      disabled={!targetUrl}
    >
      {children}
    </Button>
  );
}

function MonitorSourceRow({ source }: { source: StatusSource }) {
  return (
    <div className="border-border border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-raised">
      <SourceRowButton source={source}>
        <SourceAvatar source={source} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-foreground-secondary text-sm">{source.name}</span>
            <span className="shrink-0 rounded-item bg-surface-raised px-1.5 py-0.5 font-mono text-dim text-w-sm uppercase tracking-wider">
              {getSourceKindBadgeLabel(source.kind)}
            </span>
          </div>
          <div className="mt-0.5 truncate text-dim text-xs">{getMonitorSecondaryText(source)}</div>
        </div>
        <SourceStatusText status={source.status} />
      </SourceRowButton>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => Promise<void> | void;
  danger?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        const result = onClick();
        if (result instanceof Promise)
          result.catch(() => {
            /* fire-and-forget */
          });
      }}
      variant={danger ? "ghost" : "secondary"}
      uppercase
      className={cn(
        "gap-1.5",
        danger
          ? "bg-red-400/10 text-red-300 hover:bg-red-400/15"
          : "text-dim hover:text-foreground-secondary"
      )}
    >
      {icon}
      {label}
    </Button>
  );
}

function SourcesInventoryRow({
  source,
  menuOpen,
  onToggleMenu,
  onToggleMuted,
  onToggleDisabled,
  onRemove,
}: {
  source: StatusSource;
  menuOpen: boolean;
  onToggleMenu: (id: string) => void;
  onToggleMuted: (id: string) => Promise<void> | void;
  onToggleDisabled: (id: string) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
}) {
  return (
    <div className="border-border border-b last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-surface-raised">
        <SourceRowButton source={source}>
          <SourceAvatar source={source} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-foreground-secondary text-sm">{source.name}</span>
              {source.muted ? (
                <span className="shrink-0 rounded-item bg-amber-400/10 px-1.5 py-0.5 font-mono text-amber-300 text-w-sm uppercase tracking-wider">
                  Muted
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 truncate text-dim text-w-sm">
              {getInventorySecondaryText(source)}
            </div>
          </div>
          <SourceStatusText status={source.status} />
        </SourceRowButton>

        <Button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu(source.id);
          }}
          variant="ghost"
          size="icon"
          uppercase={false}
          className="shrink-0 text-dim hover:bg-secondary hover:text-foreground-secondary"
          aria-label={`Open actions for ${source.name}`}
        >
          <MoreHorizontal className="icon-sm" />
        </Button>
      </div>

      {menuOpen ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-border border-t bg-surface px-4 pt-2 pb-3">
          <ActionButton
            label={source.muted ? "Unmute alerts" : "Mute alerts"}
            icon={source.muted ? <Bell className="icon-sm" /> : <BellOff className="icon-sm" />}
            onClick={async () => {
              await onToggleMuted(source.id);
              onToggleMenu(source.id);
            }}
          />
          <ActionButton
            label={source.disabled ? "Enable source" : "Disable source"}
            icon={source.disabled ? <Eye className="icon-sm" /> : <EyeOff className="icon-sm" />}
            onClick={async () => {
              await onToggleDisabled(source.id);
              onToggleMenu(source.id);
            }}
          />
          {source.kind === "standalone" ? (
            <ActionButton
              label="Remove"
              icon={<Trash2 className="icon-sm" />}
              onClick={async () => {
                await onRemove(source.id);
                onToggleMenu(source.id);
              }}
              danger
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCount({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-dim text-xs">{label}</span>
      <span className="font-mono text-dim text-w-sm uppercase tracking-wider">{count}</span>
    </div>
  );
}

function MonitorHealthySummary({
  activeSources,
  disabledCount,
}: {
  activeSources: StatusSource[];
  disabledCount: number;
}) {
  const healthyGroups = SOURCE_KIND_ORDER.map((kind) => ({
    kind,
    sources: activeSources.filter(
      (source) => source.kind === kind && source.status === "operational"
    ),
  })).filter((group) => group.sources.length > 0);

  if (healthyGroups.length === 0 && disabledCount === 0) {
    return null;
  }

  return (
    <div className="mt-4 border-border border-t">
      <div className="flex items-center justify-between px-4 py-2 font-mono text-dim text-w-sm uppercase tracking-wider">
        <span>Collapsed Healthy Services</span>
        <span>{healthyGroups.reduce((total, group) => total + group.sources.length, 0)}</span>
      </div>
      <div className="divide-y divide-border">
        {healthyGroups.map((group) => (
          <SummaryCount
            key={group.kind}
            count={group.sources.length}
            label={SOURCE_KIND_SECTION_TITLES[group.kind]}
          />
        ))}
        {disabledCount > 0 ? <SummaryCount count={disabledCount} label="Disabled sources" /> : null}
      </div>
    </div>
  );
}

function StatusSummaryHeader({
  activeSources,
  operationalCount,
  totalCount,
}: {
  activeSources: StatusSource[];
  operationalCount: number;
  totalCount: number;
}) {
  return (
    <div className="border-border border-b bg-surface">
      <div className="px-4 py-4">
        <div className="flex items-baseline gap-2">
          <span
            className={cn("font-bold font-mono text-2xl", getOverallStatusColor(activeSources))}
          >
            {operationalCount}/{totalCount}
          </span>
          <span className="text-dim text-xs">operational</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {(["operational", "degraded", "outage", "unknown"] as ServiceStatus[]).map((status) => {
            const count = activeSources.filter((source) => source.status === status).length;
            if (count === 0) return null;

            return (
              <div key={status} className="flex items-center gap-1">
                <span className={cn("h-2 w-2 rounded-full", STATUS_COLORS[status])} />
                <span className="font-mono text-muted-foreground text-xs">{count}</span>
                <span className="text-dim text-w-sm">{STATUS_LABELS[status]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatusTabs({
  activeTab,
  issueCount,
  totalSources,
}: {
  activeTab: OverlayTab;
  issueCount: number;
  totalSources: number;
}) {
  return (
    <TabsList>
      <TabsTrigger value="monitor" className="gap-2">
        <span>Monitor</span>
        <span
          className={cn(
            "rounded-full bg-secondary px-1.5 py-0.5 text-dim text-w-sm",
            activeTab === "monitor" ? "text-foreground" : undefined
          )}
        >
          {issueCount}
        </span>
      </TabsTrigger>
      <TabsTrigger value="sources" className="gap-2">
        <span>Sources</span>
        <span
          className={cn(
            "rounded-full bg-secondary px-1.5 py-0.5 text-dim text-w-sm",
            activeTab === "sources" ? "text-foreground" : undefined
          )}
        >
          {totalSources}
        </span>
      </TabsTrigger>
    </TabsList>
  );
}

function MonitorTab({
  sources,
  disabledCount,
}: {
  sources: StatusSource[];
  disabledCount: number;
}) {
  const issueCount = sources.filter((source) => source.status !== "operational").length;
  const sortedIssues = MONITOR_STATUS_ORDER.map((status) => ({
    status,
    title: MONITOR_SECTION_TITLES[status],
    sources: sortSourcesByName(sources.filter((source) => source.status === status)),
  })).filter((section) => section.sources.length > 0);

  if (sources.length === 0 && disabledCount === 0) {
    return (
      <PluginEmptyState
        title="No services monitored yet"
        description="Add your first source in the Sources tab."
      />
    );
  }

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden">
      <div className="px-4 py-4">
        {issueCount === 0 ? (
          <div className="rounded-item border border-emerald-400/15 bg-emerald-400/5 px-4 py-4">
            <div className="font-medium text-emerald-300 text-sm">All systems operational</div>
            <div className="mt-1 text-emerald-400/70 text-xs">
              Healthy services stay collapsed here so the drawer remains focused on incidents.
            </div>
          </div>
        ) : null}

        {sortedIssues.map((section) => (
          <div key={section.status} className="mb-4 last:mb-0">
            <div className="flex items-center justify-between px-1 py-2 font-mono text-dim text-w-sm uppercase tracking-wider">
              <span>{section.title}</span>
              <span>{section.sources.length}</span>
            </div>
            <div className="overflow-hidden rounded-item border border-border bg-surface">
              {section.sources.map((source) => (
                <MonitorSourceRow key={source.id} source={source} />
              ))}
            </div>
          </div>
        ))}

        <MonitorHealthySummary activeSources={sources} disabledCount={disabledCount} />
      </div>
    </div>
  );
}

function SourcesSection({
  title,
  sources,
  openMenuId,
  onToggleMenu,
  onToggleMuted,
  onToggleDisabled,
  onRemove,
}: {
  title: string;
  sources: StatusSource[];
  openMenuId: string | null;
  onToggleMenu: (id: string) => void;
  onToggleMuted: (id: string) => Promise<void> | void;
  onToggleDisabled: (id: string) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
}) {
  if (sources.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2 font-mono text-dim text-w-sm uppercase tracking-wider">
        <span>{title}</span>
        <span>{sources.length}</span>
      </div>
      <div className="overflow-hidden rounded-item border border-border bg-surface">
        {sources.map((source) => (
          <SourcesInventoryRow
            key={source.id}
            source={source}
            menuOpen={openMenuId === source.id}
            onToggleMenu={onToggleMenu}
            onToggleMuted={onToggleMuted}
            onToggleDisabled={onToggleDisabled}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}

function SourcesTab({
  sources,
  searchQuery,
  showForm,
  openMenuId,
  onSearchChange,
  onShowForm,
  onAddSource,
  onCancelForm,
  onToggleMenu,
  onToggleMuted,
  onToggleDisabled,
  onRemove,
}: {
  sources: StatusSource[];
  searchQuery: string;
  showForm: boolean;
  openMenuId: string | null;
  onSearchChange: (value: string) => void;
  onShowForm: () => void;
  onAddSource: (input: { name: string; url: string; statusPageUrl?: string }) => Promise<void>;
  onCancelForm: () => void;
  onToggleMenu: (id: string) => void;
  onToggleMuted: (id: string) => Promise<void> | void;
  onToggleDisabled: (id: string) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
}) {
  const filteredSources = sortSourcesByName(
    sources.filter((source) => sourceMatchesSearch(source, searchQuery))
  );
  const sections = {
    project: filteredSources.filter((source) => source.kind === "project" && !source.disabled),
    standalone: filteredSources.filter(
      (source) => source.kind === "standalone" && !source.disabled
    ),
    integration: filteredSources.filter(
      (source) => source.kind === "integration" && !source.disabled
    ),
    disabled: filteredSources.filter((source) => source.disabled),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PluginListHeader
        label="Sources"
        search={{
          value: searchQuery,
          onChange: onSearchChange,
          placeholder: "Search sources...",
        }}
        addButton={{ label: "Add Source", onClick: onShowForm }}
        count={
          filteredSources.length === sources.length
            ? `${sources.length} service${sources.length !== 1 ? "s" : ""}`
            : `${filteredSources.length} of ${sources.length} services`
        }
      />

      <SourceFormDialog
        open={showForm}
        onClose={onCancelForm}
        onSubmit={(input) => {
          onAddSource(input).catch(() => {
            /* fire-and-forget */
          });
          onCancelForm();
        }}
      />

      <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
        {sources.length === 0 && (
          <PluginEmptyState
            title="No services monitored yet"
            description="Add your first source to start monitoring."
            action={{ label: "Add Source", onClick: onShowForm }}
          />
        )}
        {sources.length > 0 && filteredSources.length === 0 && (
          <PluginEmptyState title={`No sources match "${searchQuery.trim()}"`} />
        )}
        {sources.length > 0 && filteredSources.length > 0 && (
          <div className="space-y-4">
            <SourcesSection
              title={SOURCE_KIND_SECTION_TITLES.project}
              sources={sections.project}
              openMenuId={openMenuId}
              onToggleMenu={onToggleMenu}
              onToggleMuted={onToggleMuted}
              onToggleDisabled={onToggleDisabled}
              onRemove={onRemove}
            />
            <SourcesSection
              title={SOURCE_KIND_SECTION_TITLES.standalone}
              sources={sections.standalone}
              openMenuId={openMenuId}
              onToggleMenu={onToggleMenu}
              onToggleMuted={onToggleMuted}
              onToggleDisabled={onToggleDisabled}
              onRemove={onRemove}
            />
            <SourcesSection
              title={SOURCE_KIND_SECTION_TITLES.integration}
              sources={sections.integration}
              openMenuId={openMenuId}
              onToggleMenu={onToggleMenu}
              onToggleMuted={onToggleMuted}
              onToggleDisabled={onToggleDisabled}
              onRemove={onRemove}
            />
            <SourcesSection
              title="Disabled"
              sources={sections.disabled}
              openMenuId={openMenuId}
              onToggleMenu={onToggleMenu}
              onToggleMuted={onToggleMuted}
              onToggleDisabled={onToggleDisabled}
              onRemove={onRemove}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusPageOverlay({ api }: PluginRenderProps) {
  const {
    sources,
    loaded,
    addSource,
    removeSource,
    toggleSourceMuted,
    toggleSourceDisabled,
    operationalCount,
    totalCount,
  } = useStatusPage(api);

  const [activeTab, setActiveTab] = useState<OverlayTab>("monitor");
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "monitor") {
      setShowForm(false);
      setOpenMenuId(null);
    }
  }, [activeTab]);

  const activeSources = sources.filter((source) => !source.disabled);
  const disabledSources = sources.filter((source) => source.disabled);
  const issueCount = activeSources.filter((source) => source.status !== "operational").length;

  const handleToggleMenu = useCallback((id: string) => {
    setOpenMenuId((current) => (current === id ? null : id));
  }, []);

  if (!loaded) {
    return <PluginEmptyState title="Loading status..." />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (value === "monitor" || value === "sources") {
            setActiveTab(value);
          }
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <StatusSummaryHeader
          activeSources={activeSources}
          operationalCount={operationalCount}
          totalCount={totalCount}
        />
        <StatusTabs activeTab={activeTab} issueCount={issueCount} totalSources={sources.length} />

        <TabsContent
          value="monitor"
          className="mt-0 flex min-h-0 flex-1 flex-col focus:outline-none"
        >
          <MonitorTab sources={activeSources} disabledCount={disabledSources.length} />
        </TabsContent>

        <TabsContent
          value="sources"
          className="mt-0 flex min-h-0 flex-1 flex-col focus:outline-none"
        >
          <SourcesTab
            sources={sources}
            searchQuery={searchQuery}
            showForm={showForm}
            openMenuId={openMenuId}
            onSearchChange={(value) => {
              setSearchQuery(value);
              setOpenMenuId(null);
            }}
            onShowForm={() => setShowForm(true)}
            onAddSource={async (input) => {
              await addSource(input);
              setShowForm(false);
              api.notify("Source added", "success");
            }}
            onCancelForm={() => setShowForm(false)}
            onToggleMenu={handleToggleMenu}
            onToggleMuted={toggleSourceMuted}
            onToggleDisabled={toggleSourceDisabled}
            onRemove={removeSource}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SourceFormDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; url: string; statusPageUrl?: string }) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [statusPageUrl, setStatusPageUrl] = useState("");
  const attachNameInputRef = useCallback((node: HTMLInputElement | null) => {
    node?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!name.trim() || !url.trim()) return;
    const result = onSubmit({
      name: name.trim(),
      url: url.trim(),
      statusPageUrl: statusPageUrl.trim() || undefined,
    });
    if (result instanceof Promise)
      result.catch(() => {
        /* fire-and-forget */
      });
    setName("");
    setUrl("");
    setStatusPageUrl("");
  }, [name, onSubmit, statusPageUrl, url]);

  return (
    <PluginFormDialog
      open={open}
      onClose={onClose}
      title="Add Source"
      onSubmit={handleSubmit}
      submitLabel="Add"
      submitDisabled={!name.trim() || !url.trim()}
    >
      <FormField label="Service Name">
        <FormInput
          ref={attachNameInputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Vercel, GitHub..."
        />
      </FormField>
      <FormField label="Service URL">
        <FormInput
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
      </FormField>
      <FormField label="Status Page URL">
        <FormInput
          type="url"
          value={statusPageUrl}
          onChange={(e) => setStatusPageUrl(e.target.value)}
          placeholder="Optional, e.g. https://status.cursor.com"
        />
      </FormField>
    </PluginFormDialog>
  );
}
