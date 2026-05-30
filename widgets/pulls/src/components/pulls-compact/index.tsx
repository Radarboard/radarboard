"use client";

import type { GitHubOpenIssueItem, GitHubOpenPRItem } from "@radarboard/types/github-activity";
import { InfoRow } from "@radarboard/ui/info-row";
import { useWidgetCallbacks } from "@radarboard/widget-engine/hooks/use-widget-callbacks";
import {
  createFeedListRecipe,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import { WidgetNotConfigured } from "@radarboard/widget-engine/widget-not-configured";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { Bot, CircleDot, GitPullRequest } from "lucide-react";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useCallback } from "react";
import { useGithubOpenIssues } from "../../hooks/use-github-open-issues";
import { useGithubOpenPrs } from "../../hooks/use-github-open-prs";

type Tab = "prs" | "issues";

interface GitHubRowProps {
  item: GitHubOpenPRItem | GitHubOpenIssueItem;
  kind: Tab;
  compact?: boolean;
}

interface CompactTabContentProps {
  tab: Tab;
  prs: GitHubOpenPRItem[];
  issues: GitHubOpenIssueItem[];
  loading: boolean;
  configured: boolean;
}

// --- Helpers ---

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function stalenessClass(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days > 30) return "text-[#e63946]";
  if (days > 7) return "text-warning";
  return "text-dim";
}

function isBot(login: string): boolean {
  return login.endsWith("[bot]");
}

// --- Label chips ---

function LabelChips({ labels }: { labels: { name: string; color: string }[] }) {
  if (labels.length === 0) return null;
  return (
    <>
      {labels.map((label) => (
        <span
          key={label.name}
          className="shrink-0 rounded-item px-1.5 py-0.5 font-mono text-w-sm"
          style={{
            color: `#${label.color}`,
            backgroundColor: `#${label.color}22`,
          }}
        >
          {label.name}
        </span>
      ))}
    </>
  );
}

// --- Row component ---

function GitHubRow({ compact, item, kind }: GitHubRowProps) {
  const color = kind === "prs" ? "#5b8af5" : "#3fb950";

  return (
    <InfoRow
      href={item.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      density={compact ? "compact" : "default"}
      className={compact ? "border-border py-1.5" : "border-border"}
      subtitleClassName="mt-0.5"
      leading={
        kind === "prs" ? (
          <GitPullRequest className="icon-xs" style={{ color }} />
        ) : (
          <CircleDot className="icon-xs" style={{ color }} />
        )
      }
      title={item.title}
      subtitle={
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {!compact && <span className="font-mono text-dim text-w-sm">{item.repo}</span>}
            <span className="font-mono text-dim text-w-sm">@{item.user.login}</span>
            {isBot(item.user.login) ? <Bot className="icon-xs text-dim" /> : null}
            {!compact && <LabelChips labels={item.labels} />}
          </div>
          <span className={`shrink-0 font-mono text-w-sm ${stalenessClass(item.updatedAt)}`}>
            {timeAgo(item.updatedAt)}
          </span>
        </div>
      }
      trailing={<span className="font-mono text-dim text-w-sm">#{item.number}</span>}
    />
  );
}

// --- Compact tab content ---

function CompactTabContent({
  tab,
  prs,
  issues,
  loading,
  configured,
  onConnectService,
}: CompactTabContentProps & { onConnectService?: (id: string) => void }) {
  const empty = (msg: string) => (
    <div className="flex h-full items-center justify-center font-mono text-dim text-w-base">
      {msg}
    </div>
  );
  if (loading) return empty("Loading...");
  if (!configured) {
    return (
      <WidgetNotConfigured serviceName="GitHub" serviceId="github" onConnect={onConnectService} />
    );
  }
  if (tab === "prs") {
    if (prs.length === 0) return empty("No open pull requests");
    return (
      <>
        {prs.map((pr) => (
          <GitHubRow key={pr.id} item={pr} kind="prs" compact />
        ))}
      </>
    );
  }
  if (issues.length === 0) return empty("No open issues");
  return (
    <>
      {issues.map((issue) => (
        <GitHubRow key={issue.id} item={issue} kind="issues" compact />
      ))}
    </>
  );
}

// --- Template config ---

export const GITHUB_ACTIVITY_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "github-activity" }],
  sections: createFeedListRecipe({
    content: {
      type: "tabs",
      defaultTab: "prs",
      variant: "compact",
      tabs: [
        {
          id: "prs",
          label: "PRs",
          icon: "pull-request",
          accentColor: "#5b8af5",
          countSource: { sourceId: "github-activity", field: "prCount", format: "number" },
          sections: [
            {
              type: "row-list",
              source: { sourceId: "github-activity", field: "prs" },
              emptyMessage: "No open pull requests",
              hrefSource: { sourceId: "github-activity", field: "htmlUrl" },
              hrefTarget: "_blank",
              itemTemplate: {
                status: {
                  source: { sourceId: "github-activity", field: "rowKind" },
                  display: "named-icon",
                },
                title: { sourceId: "github-activity", field: "title" },
                subtitle: { sourceId: "github-activity", field: "user.login" },
                badge: {
                  label: { sourceId: "github-activity", field: "repo" },
                  color: { sourceId: "github-activity", field: "repoColor" },
                },
                value: { sourceId: "github-activity", field: "number", format: "number" },
                timestamp: { sourceId: "github-activity", field: "ageLabel" },
                timestampColor: { sourceId: "github-activity", field: "ageColor" },
              },
            },
          ],
        },
        {
          id: "issues",
          label: "Issues",
          icon: "issue",
          accentColor: "#3fb950",
          countSource: { sourceId: "github-activity", field: "issueCount", format: "number" },
          sections: [
            {
              type: "row-list",
              source: { sourceId: "github-activity", field: "issues" },
              emptyMessage: "No open issues",
              hrefSource: { sourceId: "github-activity", field: "htmlUrl" },
              hrefTarget: "_blank",
              itemTemplate: {
                status: {
                  source: { sourceId: "github-activity", field: "rowKind" },
                  display: "named-icon",
                },
                title: { sourceId: "github-activity", field: "title" },
                subtitle: { sourceId: "github-activity", field: "user.login" },
                badge: {
                  label: { sourceId: "github-activity", field: "repo" },
                  color: { sourceId: "github-activity", field: "repoColor" },
                },
                value: { sourceId: "github-activity", field: "number", format: "number" },
                timestamp: { sourceId: "github-activity", field: "ageLabel" },
                timestampColor: { sourceId: "github-activity", field: "ageColor" },
              },
            },
          ],
        },
      ],
    },
  }),
};

export function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}

// --- Compact view ---

export function GitHubActivityCompact({
  widgetId,
  projectSlug,
  timeRange = "30d",
  config,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const {
    items: prs,
    loading: prsLoading,
    configured: prsConfigured,
    fetchedAt: prsFetchedAt,
    refetch: refetchPrs,
  } = useGithubOpenPrs(projectSlug, timeRange);
  const {
    items: issues,
    loading: issuesLoading,
    configured: issuesConfigured,
    fetchedAt: issuesFetchedAt,
    refetch: refetchIssues,
  } = useGithubOpenIssues(projectSlug, timeRange);

  const combinedFetchedAt =
    prsFetchedAt && issuesFetchedAt
      ? Math.min(prsFetchedAt, issuesFetchedAt)
      : (prsFetchedAt ?? issuesFetchedAt);

  const combinedRefetch = useCallback(async () => {
    await Promise.all([refetchPrs(), refetchIssues()]);
  }, [refetchPrs, refetchIssues]);

  const configured = prsConfigured && issuesConfigured;

  useWidgetCallbacks({
    widgetId,
    projectSlug,
    timeRange,
    sourceIds: ["github-activity"],
    fetchedAt: configured ? combinedFetchedAt : null,
    loading: prsLoading || issuesLoading,
    error: null,
    refetch: combinedRefetch,
    chromeStatus: !(prsLoading || issuesLoading) && !configured ? "disconnected" : "default",
    onFetchedAt,
    onRefetch,
    onChromeStateChange,
  });

  const templateConfig = isTemplateConfig(config) ? config : GITHUB_ACTIVITY_TEMPLATE_CONFIG;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-full flex-col"
      >
        {prsLoading && issuesLoading ? (
          <CompactTabContent
            tab="prs"
            prs={prs}
            issues={issues}
            loading={true}
            configured={prsConfigured || issuesConfigured}
            onConnectService={onConnectService}
          />
        ) : (
          <TemplateWidget
            widgetId={widgetId}
            projectSlug={projectSlug}
            timeRange={timeRange}
            config={templateConfig}
            onFetchedAt={onFetchedAt}
            onRefetch={onRefetch}
            onChromeStateChange={onChromeStateChange}
            onConnectService={onConnectService}
          />
        )}
      </m.div>
    </LazyMotion>
  );
}
