"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { CircleDot, GitPullRequest } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useResolvedData } from "../../data-resolver";
import type { TabConfig, TabsSectionConfig } from "../../types";

interface TabsSectionProps {
  config: TabsSectionConfig;
  depth: number;
  renderedTabs: Record<string, ReactNode>;
}

function readTabFromQuery(queryParam: string, tabIds: string[]): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(queryParam);
  return value && tabIds.includes(value) ? value : null;
}

function writeTabToQuery(queryParam: string, tabId: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(queryParam, tabId);
  window.history.replaceState(window.history.state, "", url.toString());
}

function resolveTabIcon(icon: TabConfig["icon"], compact: boolean): ReactNode | undefined {
  const className = compact ? "icon-xs" : "icon-xs";
  switch (icon) {
    case "pull-request":
      return <GitPullRequest className={className} />;
    case "issue":
      return <CircleDot className={className} />;
    default:
      return undefined;
  }
}

function TemplateTabButton({
  tab,
  compact,
  active,
  onSelect,
}: {
  tab: TabConfig;
  compact: boolean;
  active: boolean;
  onSelect: (tabId: string) => void;
}) {
  const resolvedCount = useResolvedData(tab.countSource);
  const accentColor = tab.accentColor ?? "#ddd";
  const accessibleLabel =
    typeof resolvedCount === "number" ? `${tab.label} (${resolvedCount})` : tab.label;

  return (
    <Button
      type="button"
      variant="ghost"
      uppercase={false}
      rounded="none"
      role="tab"
      aria-label={accessibleLabel}
      tabIndex={active ? 0 : -1}
      aria-selected={active}
      data-state={active ? "active" : "inactive"}
      onClick={() => onSelect(tab.id)}
      className={cn(
        "flex flex-none items-center gap-1.5 rounded-none border-transparent border-b-2 bg-transparent font-mono normal-case tracking-normal transition-colors",
        compact ? "px-3 py-2 text-w-sm" : "px-4 py-2.5 text-w-base",
        active ? "text-foreground-secondary" : "text-dim hover:text-muted-foreground"
      )}
      style={
        active
          ? {
              color: accentColor,
              borderBottomColor: accentColor,
            }
          : undefined
      }
    >
      {tab.icon ? <span className="shrink-0">{resolveTabIcon(tab.icon, compact)}</span> : null}
      {tab.label}
      {typeof resolvedCount === "number" ? (
        <span
          className={cn(
            "rounded-item px-1.5 text-w-sm",
            active ? "text-foreground-secondary" : "bg-secondary text-dim"
          )}
          style={
            active
              ? {
                  color: accentColor,
                  backgroundColor: `${accentColor}10`,
                }
              : undefined
          }
        >
          {resolvedCount}
        </span>
      ) : null}
    </Button>
  );
}

export function TabsSection({ config, depth, renderedTabs }: TabsSectionProps) {
  const defaultTab = config.defaultTab ?? config.tabs[0]?.id;
  const tabIds = useMemo(() => config.tabs.map((tab) => tab.id), [config.tabs]);
  const [activeTab, setActiveTab] = useState(() => {
    if (!defaultTab) return undefined;
    if (config.queryParam) {
      return readTabFromQuery(config.queryParam, tabIds) ?? defaultTab;
    }
    return defaultTab;
  });

  useEffect(() => {
    if (depth >= 3 || !config.queryParam || !defaultTab) return;
    const nextTab = readTabFromQuery(config.queryParam, tabIds);
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
      return;
    }
    if (!nextTab && activeTab) {
      writeTabToQuery(config.queryParam, activeTab);
    }
  }, [activeTab, config.queryParam, defaultTab, depth, tabIds]);

  useEffect(() => {
    if (depth >= 3 || !config.queryParam || !defaultTab) return;

    const handlePopState = () => {
      const nextTab = readTabFromQuery(config.queryParam ?? "", tabIds) ?? defaultTab;
      setActiveTab(nextTab);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [config.queryParam, defaultTab, depth, tabIds]);

  if (depth >= 3) {
    return (
      <div className="flex min-h-widget-sm items-center justify-center px-3 font-mono text-dim text-w-sm">
        Nested tabs are limited to three levels.
      </div>
    );
  }

  if (!defaultTab) return null;

  const compact = (config.variant ?? "expanded") === "compact";
  const activeConfig = config.tabs.find((tab) => tab.id === activeTab) ?? config.tabs[0];
  if (!activeConfig) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex items-center gap-0 border-border border-b bg-surface"
      >
        {config.tabs.map((tab) => (
          <TemplateTabButton
            key={tab.id}
            tab={tab}
            compact={compact}
            active={activeTab === tab.id}
            onSelect={(tabId) => {
              setActiveTab(tabId);
              if (config.queryParam) {
                writeTabToQuery(config.queryParam, tabId);
              }
            }}
          />
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderedTabs[activeConfig.id] ?? null}
      </div>
    </div>
  );
}
