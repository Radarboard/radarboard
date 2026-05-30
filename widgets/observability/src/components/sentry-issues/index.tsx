"use client";

import { Sparkline } from "@radarboard/charts/sparkline";
import type { SentryIssueItem, SentryOverview } from "@radarboard/types/sentry";
import { InfoRow } from "@radarboard/ui/info-row";
import { ScrollArea } from "@radarboard/ui/scroll-area";
import { cn } from "@radarboard/utils/cn";
import { formatNumber } from "@radarboard/utils/format-number";
import { CompactProjectBadge } from "@radarboard/widget-engine/compact-project-badge";
import { AlertTriangle, Bug, CircleAlert, Info, OctagonAlert } from "lucide-react";

// --- Level Badge ---

function LevelBadge({ level }: { level: SentryIssueItem["level"] }) {
  const getIcon = () => {
    if (level === "fatal") return OctagonAlert;
    if (level === "error") return CircleAlert;
    if (level === "warning") return AlertTriangle;
    if (level === "info") return Info;
    return Bug;
  };
  const Icon = getIcon();

  return (
    <span
      title={level}
      className={cn(
        "icon-base inline-flex items-center justify-center rounded-item",
        level === "fatal" && "bg-[#e05555]/20 text-destructive",
        level === "error" && "bg-[#e05555]/10 text-[#c44]",
        level === "warning" && "bg-[#f5c542]/10 text-warning",
        level === "info" && "bg-accent/10 text-accent",
        level === "debug" && "bg-[#555]/10 text-dim"
      )}
    >
      <Icon className="icon-xs" aria-hidden="true" />
    </span>
  );
}

// --- Time Ago ---

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// --- Sentry Issues Widget ---

interface SentryIssuesProps {
  data: SentryOverview;
}

export function SentryIssues({ data }: SentryIssuesProps) {
  return (
    <div className="flex h-full">
      {/* Left: summary + sparkline */}
      <div className="flex w-48 shrink-0 flex-col border-border border-r">
        <div className="border-border border-b p-3">
          <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Unresolved</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "font-bold font-mono text-w-2xl",
                data.unresolvedCount > 0 ? "text-destructive" : "text-success"
              )}
            >
              {data.unresolvedCount}
            </span>
            <span className="font-mono text-dim text-w-sm">issues</span>
          </div>
        </div>
        {data.errorTrend.length > 0 && (
          <div className="p-3">
            <span className="font-mono text-dim text-w-sm uppercase tracking-wider">
              24h error trend
            </span>
            <div className="mt-1">
              <Sparkline
                data={data.errorTrend.map((d) => ({ value: d.value }))}
                positive={false}
                height={40}
              />
            </div>
          </div>
        )}
      </div>

      {/* Right: issue list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {data.issues.length === 0 ? (
            <div className="px-3 py-4 text-center font-mono text-dim text-w-base">
              No unresolved issues
            </div>
          ) : (
            data.issues.map((issue) => (
              <InfoRow
                key={issue.id}
                href={issue.permalink}
                target="_blank"
                rel="noopener noreferrer"
                density="compact"
                divider
                className="py-1.5"
                subtitleClassName="mt-0.5"
                leading={<LevelBadge level={issue.level} />}
                title={issue.title}
                subtitleStart={
                  <>
                    {issue.projectColor ? (
                      <CompactProjectBadge
                        color={issue.projectColor}
                        label={issue.projectSlug ?? issue.projectName}
                      />
                    ) : null}
                    <span className="truncate font-mono text-dim text-w-sm">{issue.culprit}</span>
                  </>
                }
                subtitleEnd={
                  <span className="shrink-0 font-mono text-dim text-w-sm">
                    {formatTimeAgo(issue.lastSeen)}
                  </span>
                }
                trailing={
                  <span className="font-mono text-dim text-w-sm">{formatNumber(issue.count)}x</span>
                }
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
