"use client";

import type { TimeRange } from "@radarboard/types/dashboard";
import type { GitHubOpenIssueItem, GitHubOpenPRItem } from "@radarboard/types/github-activity";
import { Button } from "@radarboard/ui/button";
import { InfoRow } from "@radarboard/ui/info-row";
import { cn } from "@radarboard/utils/cn";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import {
  type WidgetSegmentedTabItem,
  WidgetSegmentedTabs,
} from "@radarboard/widget-engine/widget-segmented-tabs";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { Bot, CircleDot, GitPullRequest } from "lucide-react";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useState } from "react";
import { useGithubOpenIssues } from "../../hooks/use-github-open-issues";
import { useGithubOpenPrs } from "../../hooks/use-github-open-prs";

type Tab = "prs" | "issues";

interface RepoStat {
  name: string;
  count: number;
  index: number;
}

interface ExpandedState {
  prs: GitHubOpenPRItem[];
  issues: GitHubOpenIssueItem[];
  allPrCount: number;
  allIssueCount: number;
  prBotCount: number;
  activeStats: RepoStat[];
  activeTotal: number;
  repoIndexMap: Map<string, number>;
  loading: boolean;
  configured: boolean;
}

interface ActivityBodyProps {
  loading: boolean;
  configured: boolean;
  tab: Tab;
  prs: GitHubOpenPRItem[];
  issues: GitHubOpenIssueItem[];
  repoIndexMap: Map<string, number>;
}

interface RepoSidebarProps {
  stats: RepoStat[];
  selected: string | null;
  onSelect: (repo: string | null) => void;
  total: number;
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

const REPO_COLORS = ["#5b8af5", "#3fb950", "#f5c542", "#e63946", "#8b5cf6", "#f97316"];

function repoColor(index: number): string {
  return REPO_COLORS[index % REPO_COLORS.length] ?? "#5b8af5";
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

interface GitHubRowProps {
  item: GitHubOpenPRItem | GitHubOpenIssueItem;
  kind: Tab;
  repoIdx?: number;
}

function GitHubRow({ item, kind, repoIdx }: GitHubRowProps) {
  const getColor = () => {
    if (repoIdx !== undefined) return repoColor(repoIdx);
    if (kind === "prs") return "#5b8af5";
    return "#3fb950";
  };
  const color = getColor();

  return (
    <InfoRow
      href={item.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      density="default"
      className="border-border"
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
            <span className="font-mono text-dim text-w-sm">{item.repo}</span>
            <span className="font-mono text-dim text-w-sm">@{item.user.login}</span>
            {isBot(item.user.login) ? <Bot className="icon-xs text-dim" /> : null}
            <LabelChips labels={item.labels} />
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

// --- Tab bar ---

function GitHubTabBar({
  tab,
  onTabChange,
  prCount,
  issueCount,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  prCount: number;
  issueCount: number;
}) {
  const items: WidgetSegmentedTabItem[] = [
    {
      id: "prs",
      label: "Pull Requests",
      icon: <GitPullRequest className="icon-xs" />,
      count: prCount,
      accentColor: "#5b8af5",
    },
    {
      id: "issues",
      label: "Issues",
      icon: <CircleDot className="icon-xs" />,
      count: issueCount,
      accentColor: "#3fb950",
    },
  ];

  return (
    <WidgetSegmentedTabs
      value={tab}
      onValueChange={(value) => onTabChange(value as Tab)}
      items={items}
      variant="expanded"
    />
  );
}

// --- Repo distribution bar ---

function RepoDistBar({ stats, total }: { stats: RepoStat[]; total: number }) {
  if (total === 0 || stats.length === 0) return null;
  return (
    <div className="flex h-2 w-full gap-px overflow-hidden rounded-item">
      {stats.map((s) => (
        <div
          key={s.name}
          className="h-full transition-all"
          style={{ width: `${(s.count / total) * 100}%`, backgroundColor: repoColor(s.index) }}
          title={`${s.name}: ${s.count}`}
        />
      ))}
    </div>
  );
}

// --- Repo sidebar ---

function RepoSidebar({ stats, selected, onSelect, total }: RepoSidebarProps) {
  return (
    <div className="scrollbar-thin w-48 shrink-0 overflow-y-auto border-border border-r py-2">
      <Button
        type="button"
        onClick={() => onSelect(null)}
        variant={selected === null ? "secondary" : "ghost"}
        uppercase={false}
        fullWidth
        className={cn(
          "h-auto justify-between px-3 py-2 font-mono text-w-base",
          selected === null
            ? "bg-surface-raised text-foreground-secondary"
            : "text-dim hover:text-muted-foreground"
        )}
      >
        <span>All repos</span>
        <span className="text-dim text-w-sm">{total}</span>
      </Button>
      {stats.map((s) => (
        <Button
          type="button"
          key={s.name}
          onClick={() => onSelect(s.name)}
          variant={selected === s.name ? "secondary" : "ghost"}
          uppercase={false}
          fullWidth
          className={cn(
            "h-auto justify-start gap-2 px-3 py-2 text-left font-mono text-w-base",
            selected === s.name
              ? "bg-surface-raised text-foreground-secondary"
              : "text-dim hover:text-muted-foreground"
          )}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: repoColor(s.index) }}
          />
          <span className="flex-1 truncate">{s.name.split("/")[1] ?? s.name}</span>
          <span className="shrink-0 text-dim text-w-sm">{s.count}</span>
        </Button>
      ))}
    </div>
  );
}

// --- Derived state ---

function buildRepoStats(items: { repo: string }[]): RepoStat[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.repo, (counts.get(item.repo) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], index) => ({ name, count, index }));
}

function useExpandedState(
  projectSlug: string | null,
  timeRange: TimeRange,
  tab: Tab,
  selectedRepo: string | null,
  hideBots: boolean
): ExpandedState {
  const {
    items: allPrs,
    loading: prsLoading,
    configured: prsConfigured,
  } = useGithubOpenPrs(projectSlug, timeRange);
  const {
    items: allIssues,
    loading: issuesLoading,
    configured: issuesConfigured,
  } = useGithubOpenIssues(projectSlug, timeRange);

  const prs = allPrs
    .filter((pr) => selectedRepo === null || pr.repo === selectedRepo)
    .filter((pr) => !hideBots || !isBot(pr.user.login));

  const issues = allIssues
    .filter((i) => selectedRepo === null || i.repo === selectedRepo)
    .filter((i) => !hideBots || !isBot(i.user.login));

  const activeStats = buildRepoStats(tab === "prs" ? allPrs : allIssues);
  const activeTotal = activeStats.reduce((s, r) => s + r.count, 0);

  const allRepos = Array.from(
    new Set([...allPrs.map((p) => p.repo), ...allIssues.map((i) => i.repo)])
  );

  return {
    prs,
    issues,
    allPrCount: allPrs.length,
    allIssueCount: allIssues.length,
    prBotCount: allPrs.filter((p) => isBot(p.user.login)).length,
    activeStats,
    activeTotal,
    repoIndexMap: new Map(allRepos.map((r, i) => [r, i])),
    loading: tab === "prs" ? prsLoading : issuesLoading,
    configured: tab === "prs" ? prsConfigured : issuesConfigured,
  };
}

// --- Activity body ---

function ActivityBody({ loading, configured, tab, prs, issues, repoIndexMap }: ActivityBodyProps) {
  const empty = (msg: string) => (
    <div className="flex h-full items-center justify-center font-mono text-dim text-w-lg">
      {msg}
    </div>
  );

  if (loading) return empty("Loading...");
  if (!configured) return empty("GitHub not configured");

  if (tab === "prs") {
    return prs.length === 0
      ? empty("No items match the current filters")
      : prs.map((pr) => (
          <GitHubRow key={pr.id} item={pr} kind="prs" repoIdx={repoIndexMap.get(pr.repo)} />
        ));
  }

  return issues.length === 0
    ? empty("No items match the current filters")
    : issues.map((issue) => (
        <GitHubRow
          key={issue.id}
          item={issue}
          kind="issues"
          repoIdx={repoIndexMap.get(issue.repo)}
        />
      ));
}

// --- Expanded view ---

export function GitHubActivityExpanded({
  projectSlug,
  timeRange = "30d",
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const [tab, setTab] = useState<Tab>("prs");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [hideBots, setHideBots] = useState(false);

  const {
    prs,
    issues,
    allPrCount,
    allIssueCount,
    prBotCount,
    activeStats,
    activeTotal,
    repoIndexMap,
    loading,
    configured,
  } = useExpandedState(projectSlug, timeRange, tab, selectedRepo, hideBots);

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-full flex-col"
      >
        {/* KPI strip */}
        <div className="grid shrink-0 grid-cols-2 gap-px bg-secondary">
          <div className="bg-surface-raised px-4 py-3">
            <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
              Open Pull Requests
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <GitPullRequest className="icon-sm text-accent" />
              <span className="font-mono text-foreground-secondary text-w-xl">{allPrCount}</span>
              {prBotCount > 0 && (
                <span className="flex items-center gap-1 font-mono text-dim text-w-sm">
                  <Bot className="icon-xs" />
                  {prBotCount} bots
                </span>
              )}
            </div>
          </div>
          <div className="bg-surface-raised px-4 py-3">
            <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Open Issues</div>
            <div className="mt-0.5 flex items-center gap-2">
              <CircleDot className="icon-sm text-[#3fb950]" />
              <span className="font-mono text-foreground-secondary text-w-xl">{allIssueCount}</span>
            </div>
          </div>
        </div>

        {/* Repo distribution bar */}
        <div className="shrink-0 border-border border-b px-4 py-2.5">
          <RepoDistBar stats={activeStats} total={activeTotal} />
        </div>

        {/* Tab bar + bot toggle */}
        <div className="flex shrink-0 items-center justify-between border-border border-b">
          <GitHubTabBar
            tab={tab}
            onTabChange={(t) => {
              setTab(t);
              setSelectedRepo(null);
            }}
            prCount={allPrCount}
            issueCount={allIssueCount}
          />
          <Button
            type="button"
            onClick={() => setHideBots((v) => !v)}
            variant={hideBots ? "secondary" : "ghost"}
            uppercase={false}
            className={cn(
              "mr-2 gap-1.5 font-mono text-w-base",
              hideBots
                ? "bg-surface-raised text-foreground-secondary"
                : "text-dim hover:text-muted-foreground"
            )}
          >
            <Bot className="icon-xs" />
            {hideBots ? "Bots hidden" : "Show bots"}
          </Button>
        </div>

        {/* Body: sidebar + list */}
        <div className="flex min-h-0 flex-1">
          <RepoSidebar
            stats={activeStats}
            selected={selectedRepo}
            onSelect={setSelectedRepo}
            total={activeTotal}
          />
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            <ActivityBody
              loading={loading}
              configured={configured}
              tab={tab}
              prs={prs}
              issues={issues}
              repoIndexMap={repoIndexMap}
            />
          </div>
        </div>
      </m.div>
    </LazyMotion>
  );
}
