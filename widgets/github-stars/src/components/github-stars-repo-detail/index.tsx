"use client";

import { MonitorLineChart } from "@radarboard/charts/line-chart";
import {
  DetailLink,
  DetailRow,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { cn } from "@radarboard/utils/cn";
import { formatNumber } from "@radarboard/utils/format-number";
import { useCurrentWidgetModalSize } from "@radarboard/widget-engine/widget-modal";
import { Star } from "lucide-react";
import { useGitHubStarsHistory } from "../../hooks/use-github-stars-history";
import type {
  GitHubRepoData,
  GitHubRepoSelection,
  GitHubStarsAddedPoint,
  GitHubStarsHistoryData,
  GitHubStarsHistoryPoint,
} from "../../types";

function toLineChartData(points: GitHubStarsHistoryPoint[]) {
  return points.map((point) => ({
    date: point.date,
    totalStars: point.totalStars,
  }));
}

function bucketHistoryPoints(points: GitHubStarsHistoryPoint[], limit: number) {
  if (points.length <= limit) return points;
  const factor = Math.ceil(points.length / limit);
  const result: GitHubStarsHistoryPoint[] = [];
  for (let i = 0; i < points.length; i += factor) {
    const p = points[i];
    if (p) result.push(p);
  }
  return result;
}

function formatAddedLabel(points: GitHubStarsAddedPoint[]) {
  const sum = points.reduce((acc, p) => acc + p.count, 0);
  return `+${formatNumber(sum)} added via Situations bridge`;
}

function resolveStatusMessage(
  isLoading: boolean,
  hasHistory: boolean,
  historyMode?: string,
  backfillStatus?: string,
  nextPage?: number | null,
  coverageMessage?: string | null
) {
  if (coverageMessage && coverageMessage.length > 0) {
    return coverageMessage;
  }
  if (isLoading && !hasHistory) return "Loading history…";
  if (historyMode === "sampled") {
    return "Large repository: sampled history shown for faster loading.";
  }
  if (backfillStatus === "backfilling") return `Backfilling history… page ${nextPage ?? "?"}`;
  if (backfillStatus === "pending") return "History sync queued.";
  if (backfillStatus === "complete") return "History synced.";
  return null;
}

function resolveRepoHistory(
  repo: GitHubRepoData,
  historyData: GitHubStarsHistoryData | null,
  isSmallModal: boolean
) {
  const repoKey = repo.repoKey ?? repo.fullName.toLowerCase();
  const hookRepo = historyData?.repos.find((item) => item.repoKey === repoKey);
  const hookHistoryPoints = historyData?.repoDaily[repoKey] ?? [];
  const hookAddedPoints = historyData?.repoAddedDaily[repoKey] ?? [];
  const rawHistoryPoints =
    hookHistoryPoints.length > 0 ? hookHistoryPoints : (repo.historyPoints ?? []);
  const historyPoints = bucketHistoryPoints(rawHistoryPoints, isSmallModal ? 24 : 48);
  const isFull = (hookRepo?.coverageStatus ?? repo.coverageStatus) === "full";

  return {
    repoKey,
    hookRepo,
    hookAddedPoints,
    historyPoints,
    isFull,
  };
}

const EMPTY_SELECTED_REPOS: GitHubRepoSelection[] = [];

export interface GitHubStarsRepoDetailProps {
  projectSlug: string | null;
  repo: GitHubRepoData;
  selectedRepos?: GitHubRepoSelection[];
}

export function GitHubStarsRepoDetail({
  projectSlug,
  repo,
  selectedRepos,
}: GitHubStarsRepoDetailProps) {
  const modalSize = useCurrentWidgetModalSize();
  const isSmallModal = modalSize === "sm";
  const effectiveSelectedRepos = selectedRepos ?? EMPTY_SELECTED_REPOS;

  const history = useGitHubStarsHistory(projectSlug, effectiveSelectedRepos, "all");
  const resolved = resolveRepoHistory(repo, history.data, isSmallModal);
  const { hookRepo, hookAddedPoints, historyPoints, isFull } = resolved;

  const hasHistory = historyPoints.length > 0;

  const statusMeta = {
    backfillStatus: hookRepo?.backfillStatus ?? repo.backfillStatus,
    historyMode: hookRepo?.historyMode ?? repo.historyMode,
    lastError: hookRepo?.lastError ?? repo.lastError,
    nextPage: hookRepo?.nextPage ?? repo.nextPage,
    isLoading: history.loading,
    hasHistory,
    coverageMessage: hookRepo?.coverageMessage ?? repo.coverageMessage,
  };

  const statusMessage = resolveStatusMessage(
    statusMeta.isLoading,
    statusMeta.hasHistory,
    statusMeta.historyMode,
    statusMeta.backfillStatus,
    statusMeta.nextPage,
    statusMeta.coverageMessage
  );

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-none border border-border bg-secondary">
            <Star className="icon-base text-accent" />
          </div>
          <div>
            <DialogTitle>{repo.fullName}</DialogTitle>
            <div className="flex items-center gap-2 font-mono text-dim text-w-xs">
              <span>{formatNumber(repo.stars)} Stars</span>
              {hookAddedPoints.length > 0 ? (
                <>
                  <span>·</span>
                  <span className="text-accent">{formatAddedLabel(hookAddedPoints)}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </DialogHeader>

      <DialogBody>
        <div className="space-y-6">
          {statusMessage ? (
            <div className="rounded-none border border-accent/20 bg-accent/5 px-3 py-2 font-mono text-accent text-w-sm">
              {statusMessage}
            </div>
          ) : null}

          <div className="rounded-none border border-border bg-surface p-4">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="font-mono text-foreground text-w-sm uppercase tracking-wider">
                Star History
              </h4>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isFull ? "bg-success" : "animate-pulse bg-warning"
                  )}
                />
                <span className="font-mono text-dim text-w-xs">
                  {isFull ? "Full History" : "Syncing…"}
                </span>
              </div>
            </div>

            <div className="h-[200px] w-full">
              {hasHistory ? (
                <MonitorLineChart
                  data={toLineChartData(historyPoints)}
                  series={[{ name: "Total Stars", color: "blue", dataKey: "totalStars" }]}
                  formatValue={(v) => formatNumber(Number(v))}
                  showXAxis={!isSmallModal}
                />
              ) : (
                <div className="flex h-full items-center justify-center font-mono text-dim text-w-sm italic">
                  No history data available
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DetailRow label="Language">{repo.language ?? "Unknown"}</DetailRow>
            <DetailRow label="Forks">{formatNumber(repo.forks)}</DetailRow>
            <DetailRow label="Open Issues">{formatNumber(repo.openIssues)}</DetailRow>
            <DetailRow label="Watchers">{formatNumber(repo.watchers)}</DetailRow>
          </div>

          {repo.description ? (
            <div className="space-y-1">
              <span className="font-mono text-dim text-w-xs uppercase tracking-wider">
                Description
              </span>
              <p className="text-foreground-secondary text-w-base">{repo.description}</p>
            </div>
          ) : null}
        </div>
      </DialogBody>

      <DialogFooter>
        <div className="flex w-full items-center justify-between">
          <DetailLink href={repo.htmlUrl}>View on GitHub</DetailLink>
          <DetailLink href={`/api/projects/${projectSlug}/integrations/github/stars/sync`}>
            Debug Sync
          </DetailLink>
        </div>
      </DialogFooter>
    </>
  );
}
