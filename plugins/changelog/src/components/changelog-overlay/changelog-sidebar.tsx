import { ColorDot } from "@radarboard/plugin-sdk/components/sidebar/color-dot";
import { FolderItem } from "@radarboard/plugin-sdk/components/sidebar/folder-item";
import { SidebarSection } from "@radarboard/plugin-sdk/components/sidebar/section-header";
import {
  SidebarHeader,
  SidebarShell,
} from "@radarboard/plugin-sdk/components/sidebar/sidebar-shell";
import { SidebarStats } from "@radarboard/plugin-sdk/components/sidebar/sidebar-stats";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { Plus, RefreshCw } from "lucide-react";
import type { ProjectSummary, ScopeKey, SummaryStats } from "../types";
import { formatRelativeDate } from "../utils";

interface ChangelogSidebarProps {
  isSyncing: boolean;
  sync: (manual: boolean) => void;
  summaryStats: SummaryStats;
  syncState: { lastSuccessAt: string | null };
  error: string | null;
  entriesCount: number;
  fullNotesCount: number;
  minimalNotesCount: number;
  prereleaseCount: number;
  scopeKey: ScopeKey;
  setScopeKey: (key: ScopeKey) => void;
  projectSummaries: ProjectSummary[];
  onOpenActions: () => void;
  onOpenManager: () => void;
}

export function ChangelogSidebar({
  isSyncing,
  sync,
  summaryStats,
  syncState,
  error,
  entriesCount,
  fullNotesCount,
  minimalNotesCount,
  prereleaseCount,
  scopeKey,
  setScopeKey,
  projectSummaries,
  onOpenActions,
  onOpenManager,
}: ChangelogSidebarProps) {
  return (
    <SidebarShell
      header={
        <SidebarHeader
          label="Changelog"
          action={
            <Button
              type="button"
              onClick={() => sync(true)}
              disabled={isSyncing}
              variant="outline"
              size="sm"
              uppercase={false}
              className="gap-1 text-muted-foreground"
            >
              <RefreshCw className={cn("icon-sm", isSyncing && "animate-spin")} />
              Sync
            </Button>
          }
          stats={
            <>
              <SidebarStats
                value={String(summaryStats.watchedCount)}
                label={`${summaryStats.unreadCount} unread · ${summaryStats.fullNotesCount} with full notes · ${summaryStats.projectCount} projects`}
              />
              <div className="mt-2 font-mono text-dim text-w-sm">
                Last sync {formatRelativeDate(syncState.lastSuccessAt)}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={onOpenActions}
                      variant="ghost"
                      size="icon"
                      uppercase={false}
                      className="text-dim hover:text-foreground-secondary"
                      aria-label="Actions"
                    >
                      <Plus className="icon-base" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Actions</TooltipContent>
                </Tooltip>
                <Button
                  type="button"
                  onClick={() => onOpenManager()}
                  variant="ghost"
                  size="sm"
                  uppercase={false}
                  className="text-dim hover:text-foreground-secondary"
                >
                  Packages
                </Button>
              </div>
              {error ? <div className="mt-2 text-destructive text-w-sm">{error}</div> : null}
            </>
          }
        />
      }
    >
      <SidebarSection title="Views">
        <FolderItem
          icon={<ColorDot color="var(--color-info)" />}
          label="All releases"
          count={entriesCount}
          selected={scopeKey === "all"}
          onClick={() => setScopeKey("all")}
        />
        <FolderItem
          icon={<ColorDot color="var(--color-accent)" />}
          label="Rich notes"
          count={fullNotesCount}
          selected={scopeKey === "quality:full"}
          onClick={() => setScopeKey("quality:full")}
        />
        <FolderItem
          icon={<ColorDot color="var(--color-warning)" />}
          label="Quick hits"
          count={minimalNotesCount}
          selected={scopeKey === "quality:minimal"}
          onClick={() => setScopeKey("quality:minimal")}
        />
        <FolderItem
          icon={<ColorDot color="var(--color-accent)" />}
          label="Canary & prerelease"
          count={prereleaseCount}
          selected={scopeKey === "prerelease"}
          onClick={() => setScopeKey("prerelease")}
        />
      </SidebarSection>

      <SidebarSection title="Projects">
        {projectSummaries.length === 0 ? (
          <div className="px-3 py-4 text-dim text-w-sm">No project scopes yet.</div>
        ) : (
          projectSummaries.map((project) => (
            <FolderItem
              key={project.projectSlug}
              icon={<ColorDot color={project.projectColor} />}
              label={project.projectName}
              count={project.releaseCount}
              selected={scopeKey === `project:${project.projectSlug}`}
              onClick={() => setScopeKey(`project:${project.projectSlug}` as ScopeKey)}
            />
          ))
        )}
      </SidebarSection>
    </SidebarShell>
  );
}
