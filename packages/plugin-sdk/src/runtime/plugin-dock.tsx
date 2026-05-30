"use client";

import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { Bug, Plus, Settings } from "lucide-react";
import { useMemo } from "react";

/** Short labels for dock display — keeps the sidebar compact. */
const PLUGIN_SHORT_LABELS: Record<string, string> = {
  tasks: "Tasks",
  expenses: "Expenses",
  notes: "Notes",
  bookmarks: "Marks",
  "rss-reader": "RSS",
  changelog: "Changes",
  "status-page": "Status",
  "webhook-relay": "Hooks",
  embeddings: "Search",
  backup: "Backup",
};

interface PluginSidebarProps {
  activePluginId: string | null;
  disabledPlugins?: Set<string>;
  statusPageIssueState?: DockIssueState;
  onLaunch: (pluginId: string) => void;
  onOpenPluginSettings?: () => void;
  onOpenDebug?: () => void;
  onOpenSettings?: () => void;
}

type DockIssueState = "outage" | "degraded" | null;

const STATUS_PAGE_PLUGIN_ID = "status-page";

function DockItem({
  icon: Icon,
  label,
  onClick,
  tooltip,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  tooltip?: string;
  className?: string;
}) {
  const btn = (
    <Button
      type="button"
      onClick={onClick}
      aria-label={tooltip ?? label}
      variant="ghost"
      uppercase={false}
      fullWidth
      className={cn(
        "h-auto flex-col gap-0.5 rounded-card px-1 py-1.5 text-dim hover:text-foreground-secondary",
        className
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="max-w-full truncate font-mono text-w-xs leading-none">{label}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }
  return btn;
}

/**
 * Permanent left sidebar showing all enabled plugin icons.
 * Inspired by Slack's workspace sidebar — always visible,
 * not floating. Replaces both the old floating dock and
 * the topbar plugin buttons.
 */
export function PluginSidebar({
  activePluginId,
  disabledPlugins = new Set<string>(),
  statusPageIssueState = null,
  onLaunch,
  onOpenPluginSettings,
  onOpenDebug,
  onOpenSettings,
}: PluginSidebarProps) {
  const plugins = useMemo(
    () => getAllPlugins().filter((plugin) => !disabledPlugins.has(plugin.id)),
    [disabledPlugins]
  );

  return (
    <nav
      className="scrollbar-thin flex w-[68px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden border-border border-r bg-background pt-2 pb-10"
      aria-label="Plugins"
    >
      {/* Plugin icons with labels */}
      <div className="flex flex-1 flex-col items-center gap-0.5">
        {plugins.map((plugin) => {
          const isActive = activePluginId === plugin.id;
          const issueState = plugin.id === STATUS_PAGE_PLUGIN_ID ? statusPageIssueState : null;
          const shortLabel = PLUGIN_SHORT_LABELS[plugin.id] ?? plugin.name.split(" ")[0];
          return (
            <Button
              key={plugin.id}
              type="button"
              onClick={() => onLaunch(plugin.id)}
              aria-label={plugin.name}
              variant={isActive ? "secondary" : "ghost"}
              uppercase={false}
              fullWidth
              className={cn(
                "group relative h-auto flex-col gap-0.5 rounded-card px-1 py-1.5",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-dim hover:text-foreground-secondary"
              )}
            >
              {isActive && (
                <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-accent" />
              )}
              {Boolean(issueState) && (
                <span
                  data-testid={`plugin-dock-indicator-${plugin.id}`}
                  className={cn(
                    "absolute top-0.5 right-1 h-2 w-2 rounded-full ring-2 ring-background",
                    issueState === "outage" ? "bg-destructive" : "bg-warning"
                  )}
                />
              )}
              <plugin.icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate font-mono text-w-xs leading-none">
                {shortLabel}
              </span>
            </Button>
          );
        })}
        <DockItem
          icon={Plus}
          label="Plugins"
          onClick={onOpenPluginSettings}
          tooltip="Manage plugins"
          className={cn(
            "mt-1 border border-border bg-secondary text-foreground-secondary hover:bg-muted hover:text-foreground",
            plugins.length === 0 && "mt-0"
          )}
        />
      </div>

      {/* Bottom section: utilities */}
      <div className="my-1 w-10 border-border border-t" />
      {onOpenSettings ? (
        <DockItem icon={Settings} label="Settings" onClick={onOpenSettings} tooltip="Settings" />
      ) : null}
      {onOpenDebug ? (
        <DockItem icon={Bug} label="Debug" onClick={onOpenDebug} tooltip="Debug" />
      ) : null}
    </nav>
  );
}
