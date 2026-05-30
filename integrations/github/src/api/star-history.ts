import type { DataSourceContext, TimeRange } from "@radarboard/integration-sdk/types";
import type {
  GitHubRepoStarDailyRow,
  GitHubRepoStarEventRow,
  GitHubRepoStarSyncStateRow,
  GitHubRepoStarTrackingRow,
  GitHubStarCoverageStatus,
  GitHubStarHistoryRepository,
} from "@radarboard/types/database";
import { getDateStringInTimeZone, getTimeRangeWindow } from "@radarboard/utils/timezone";
import type { GitHubConfig } from "../types";
import { getRepository, getStargazersGraphqlPage, getStargazersPage } from "./client";

const STARGAZERS_PER_PAGE = 100;
const MAX_PAGES_PER_SYNC = 10;
type RepoRef = { owner: string; repo: string };
type GitHubStarsSyncMode = "incremental" | "full";
type GitHubStarsHistoryMode = "exact" | "sampled";

export interface GitHubStarsHistoryPoint {
  date: string;
  totalStars: number;
  starsGained: number;
}

export interface GitHubStarsAddedPoint {
  date: string;
  count: number;
}

export interface GitHubStarsHistoryData {
  aggregateDaily: GitHubStarsHistoryPoint[];
  repoDaily: Record<string, GitHubStarsHistoryPoint[]>;
  aggregateAddedDaily: GitHubStarsAddedPoint[];
  repoAddedDaily: Record<string, GitHubStarsAddedPoint[]>;
  repos: Array<{
    repoKey: string;
    fullName: string;
    latestStars: number;
    backfillStatus: GitHubRepoStarSyncStateRow["backfillStatus"];
    lastSyncedAt: number | null;
    nextPage?: number | null;
    historyMode?: GitHubStarsHistoryMode;
    lastError?: string | null;
    trackingStartedAt?: number | null;
    baselineStars?: number | null;
    lastWebhookAt?: number | null;
    coverageStatus?: GitHubStarCoverageStatus;
    coverageMessage?: string | null;
  }>;
  latestSyncAt: number | null;
}

function normalizeRepoKey({ owner, repo }: RepoRef): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

function formatTrackingDate(epochSeconds: number, timeZone: string): string {
  return getDateStringInTimeZone(new Date(epochSeconds * 1000), timeZone);
}

function toUtcDay(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toISOString().slice(0, 10);
}

function addUtcDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return toUtcDay(date);
}

function getRangeStartDay(today: string, range: Exclude<TimeRange, "all">): string {
  const date = new Date(`${today}T00:00:00.000Z`);

  switch (range) {
    case "today":
      return today;
    case "7d":
      date.setUTCDate(date.getUTCDate() - 6);
      return toUtcDay(date);
    case "15d":
      date.setUTCDate(date.getUTCDate() - 14);
      return toUtcDay(date);
    case "30d":
      date.setUTCDate(date.getUTCDate() - 29);
      return toUtcDay(date);
    case "3m":
      date.setUTCMonth(date.getUTCMonth() - 3);
      date.setUTCDate(date.getUTCDate() + 1);
      return toUtcDay(date);
    case "1y":
      date.setUTCFullYear(date.getUTCFullYear() - 1);
      date.setUTCDate(date.getUTCDate() + 1);
      return toUtcDay(date);
    default:
      throw new Error(`Unexpected range: ${range satisfies never}`);
  }
}

function applyRange(
  points: GitHubStarsHistoryPoint[],
  range: TimeRange
): GitHubStarsHistoryPoint[] {
  if (range === "all") return points;
  if (points.length === 0) return points;

  const today = toUtcDay(new Date());
  const startDay = getRangeStartDay(today, range);
  return points.filter((point) => point.date >= startDay && point.date <= today);
}

function buildAddedPoints(
  events: GitHubRepoStarEventRow[],
  range: TimeRange,
  timeZone: string
): GitHubStarsAddedPoint[] {
  const { startDate, endDate } = getTimeRangeWindow(range, timeZone);
  const counts = new Map<string, number>();

  for (const event of events) {
    if (event.action !== "created") continue;
    const date = getDateStringInTimeZone(new Date(event.occurredAt * 1000), timeZone);
    if (date < startDate || date > endDate) continue;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, count]) => ({ date, count }));
}

function sumNetEventsSince(events: GitHubRepoStarEventRow[], occurredAfter: number): number {
  return events.reduce((sum, event) => {
    if (event.occurredAt < occurredAfter) return sum;
    return sum + (event.action === "created" ? 1 : -1);
  }, 0);
}

function aggregateAddedHistory(
  histories: Record<string, GitHubStarsAddedPoint[]>
): GitHubStarsAddedPoint[] {
  const totals = new Map<string, number>();

  for (const points of Object.values(histories)) {
    for (const point of points) {
      totals.set(point.date, (totals.get(point.date) ?? 0) + point.count);
    }
  }

  return [...totals.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, count]) => ({ date, count }));
}

function resolveCoverage(
  tracking: GitHubRepoStarTrackingRow | null,
  events: GitHubRepoStarEventRow[],
  latestStars: number,
  rangeStartAt: number,
  timeZone: string
): { status: GitHubStarCoverageStatus; message: string } {
  if (!tracking?.trackingStartedAt || rangeStartAt < tracking.trackingStartedAt) {
    const message =
      tracking?.trackingStartedAt != null
        ? `Tracking since ${formatTrackingDate(tracking.trackingStartedAt, timeZone)}`
        : "Tracking not started";
    return { status: "range_before_tracking", message };
  }

  if (tracking.baselineStars == null) {
    return { status: "gap", message: "Tracking baseline missing" };
  }

  const expectedCurrentStars =
    tracking.baselineStars + sumNetEventsSince(events, tracking.trackingStartedAt);
  if (expectedCurrentStars !== latestStars) {
    return { status: "gap", message: "Webhook gap detected" };
  }

  return { status: "full", message: "Tracking healthy" };
}

function buildDailyRows(
  repoKey: string,
  dayCounts: Map<string, number>,
  options: {
    complete: boolean;
    currentStars: number;
    updatedAt: number;
    today: string;
  }
): GitHubRepoStarDailyRow[] {
  const knownDays = [...dayCounts.keys()].sort((left, right) => left.localeCompare(right));
  const earliestDay = knownDays[0] ?? (options.complete ? options.today : null);

  if (!earliestDay) return [];

  const latestKnownDay = knownDays[knownDays.length - 1] ?? earliestDay;
  const endDay =
    options.complete && options.today > latestKnownDay ? options.today : latestKnownDay;

  const rows: GitHubRepoStarDailyRow[] = [];
  let day = earliestDay;
  let previousTotal = 0;

  while (day <= endDay) {
    const starsGained = dayCounts.get(day) ?? 0;
    const totalStars = previousTotal + starsGained;
    rows.push({
      repoKey,
      day,
      totalStars,
      starsGained,
      source: "backfill",
      updatedAt: options.updatedAt,
    });
    previousTotal = totalStars;
    day = addUtcDays(day, 1);
  }

  if (!options.complete) return rows;

  const todayIndex = rows.findIndex((row) => row.day === options.today);
  if (todayIndex === -1) {
    const prevTotal = rows[rows.length - 1]?.totalStars ?? 0;
    rows.push({
      repoKey,
      day: options.today,
      totalStars: options.currentStars,
      starsGained: options.currentStars - prevTotal,
      source: "daily-sync",
      updatedAt: options.updatedAt,
    });
    return rows;
  }

  const prevTotal = todayIndex > 0 ? (rows[todayIndex - 1]?.totalStars ?? 0) : 0;
  const currentRow = rows[todayIndex];
  if (!currentRow) return rows;
  rows[todayIndex] = {
    repoKey: currentRow.repoKey,
    day: currentRow.day,
    totalStars: options.currentStars,
    starsGained: options.currentStars - prevTotal,
    source: "daily-sync",
    updatedAt: options.updatedAt,
  };

  return rows;
}

async function buildGraphqlBackfillRows(
  repoRef: RepoRef,
  repoKey: string,
  config: GitHubConfig,
  updatedAt: number
): Promise<GitHubRepoStarDailyRow[]> {
  const dayCounts = new Map<string, number>();
  let after: string | null = null;
  let hasNextPage = true;
  let latestStars = 0;

  while (hasNextPage) {
    const page = await getStargazersGraphqlPage(
      config,
      repoRef.owner,
      repoRef.repo,
      after,
      STARGAZERS_PER_PAGE
    );

    latestStars = page.totalCount;
    for (const edge of page.edges) {
      const day = toUtcDay(edge.starredAt);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }

    hasNextPage = page.pageInfo.hasNextPage;
    after = page.pageInfo.endCursor;
  }

  return buildDailyRows(repoKey, dayCounts, {
    complete: true,
    currentStars: latestStars,
    updatedAt,
    today: toUtcDay(new Date()),
  });
}

function isPaginationLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("pagination is limited");
}

async function getHistoryRepo(ctx: DataSourceContext): Promise<GitHubStarHistoryRepository> {
  const repo = ctx.getGitHubStarHistoryRepo?.();
  if (!repo) {
    throw new Error("GitHub star history repository is not configured");
  }
  return repo;
}

async function performRestBackfill(
  repoRef: RepoRef,
  config: GitHubConfig,
  dayCounts: Map<string, number>,
  nextPage: number | null,
  syncMode: GitHubStarsSyncMode
): Promise<{ nextPage: number | null; oldestSeenStarredAt: string | null; complete: boolean }> {
  let currentPage = nextPage ?? 1;
  let complete = false;
  let oldestSeenStarredAt: string | null = null;
  let remainingPages = syncMode === "full" ? Number.MAX_SAFE_INTEGER : MAX_PAGES_PER_SYNC;

  while (remainingPages > 0) {
    const stargazers = await getStargazersPage(
      config,
      repoRef.owner,
      repoRef.repo,
      currentPage,
      STARGAZERS_PER_PAGE
    );

    if (stargazers.length === 0) {
      complete = true;
      currentPage = 0;
      break;
    }

    for (const stargazer of stargazers) {
      const day = toUtcDay(stargazer.starred_at);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      if (!oldestSeenStarredAt || stargazer.starred_at < oldestSeenStarredAt) {
        oldestSeenStarredAt = stargazer.starred_at;
      }
    }

    if (stargazers.length < STARGAZERS_PER_PAGE) {
      complete = true;
      currentPage = 0;
      break;
    }

    currentPage += 1;
    remainingPages -= 1;
  }

  return {
    nextPage: complete ? null : currentPage,
    oldestSeenStarredAt,
    complete,
  };
}

async function handleSyncError(
  error: unknown,
  repoRef: RepoRef,
  key: string,
  config: GitHubConfig,
  historyRepo: GitHubStarHistoryRepository,
  now: number,
  nextPage: number | null,
  oldestSeenStarredAt: string | null,
  syncState: GitHubRepoStarSyncStateRow | null,
  existingRows: GitHubRepoStarDailyRow[],
  repository: { full_name: string; stargazers_count: number }
): Promise<{ meta: GitHubStarsHistoryData["repos"][number]; points: GitHubStarsHistoryPoint[] }> {
  if (isPaginationLimitError(error)) {
    const graphRows = await buildGraphqlBackfillRows(repoRef, key, config, now);

    await Promise.all([
      historyRepo.upsertDaily(graphRows),
      historyRepo.upsertSyncState({
        repoKey: key,
        backfillStatus: "complete",
        nextPage: null,
        oldestSeenStarredAt,
        lastSyncedAt: now,
        lastError: null,
        updatedAt: now,
      }),
    ]);

    return {
      meta: {
        repoKey: key,
        fullName: repository.full_name,
        latestStars: repository.stargazers_count,
        backfillStatus: "complete",
        lastSyncedAt: now,
        nextPage: null,
        historyMode: "exact",
        lastError: null,
      },
      points: graphRows.map((row) => ({
        date: row.day,
        totalStars: row.totalStars,
        starsGained: row.starsGained,
      })),
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  await historyRepo.upsertSyncState({
    repoKey: key,
    backfillStatus: "error",
    nextPage,
    oldestSeenStarredAt,
    lastSyncedAt: syncState?.lastSyncedAt ?? null,
    lastError: message,
    updatedAt: now,
  });

  return {
    meta: {
      repoKey: key,
      fullName: repository.full_name,
      latestStars: repository.stargazers_count,
      backfillStatus: "error",
      lastSyncedAt: syncState?.lastSyncedAt ?? null,
      nextPage,
      historyMode: "exact",
      lastError: message,
    },
    points: existingRows.map((row) => ({
      date: row.day,
      totalStars: row.totalStars,
      starsGained: row.starsGained,
    })),
  };
}

async function syncSingleRepo(
  repoRef: RepoRef,
  config: GitHubConfig,
  historyRepo: GitHubStarHistoryRepository,
  syncMode: GitHubStarsSyncMode
): Promise<{
  meta: GitHubStarsHistoryData["repos"][number];
  points: GitHubStarsHistoryPoint[];
}> {
  const key = normalizeRepoKey(repoRef);
  const now = Math.floor(Date.now() / 1000);
  const today = toUtcDay(new Date());

  const [repository, existingRows, syncState] = await Promise.all([
    getRepository(config, repoRef.owner, repoRef.repo),
    historyRepo.getDaily([key]),
    historyRepo.getSyncStates([key]).then((rows) => rows[0] ?? null),
  ]);

  const dayCounts = new Map(existingRows.map((row) => [row.day, row.starsGained]));
  let nextPage: number | null = syncState?.nextPage ?? 1;
  let status = syncState?.backfillStatus ?? "pending";
  let oldestSeenStarredAt = syncState?.oldestSeenStarredAt ?? null;
  const estimatedPageCount = Math.max(
    1,
    Math.ceil(repository.stargazers_count / STARGAZERS_PER_PAGE)
  );
  let rows: GitHubRepoStarDailyRow[] = existingRows;

  try {
    if (estimatedPageCount > 400) {
      if (syncMode === "full" || existingRows.length === 0) {
        rows = await buildGraphqlBackfillRows(repoRef, key, config, now);
      } else {
        rows = buildDailyRows(key, dayCounts, {
          complete: true,
          currentStars: repository.stargazers_count,
          updatedAt: now,
          today,
        });
      }
      status = "complete";
      nextPage = null;
    } else if (status !== "complete") {
      const result = await performRestBackfill(repoRef, config, dayCounts, nextPage, syncMode);
      nextPage = result.nextPage;
      if (result.oldestSeenStarredAt) oldestSeenStarredAt = result.oldestSeenStarredAt;
      status = result.complete ? "complete" : "backfilling";
      rows = buildDailyRows(key, dayCounts, {
        complete: status === "complete",
        currentStars: repository.stargazers_count,
        updatedAt: now,
        today,
      });
    } else {
      rows = buildDailyRows(key, dayCounts, {
        complete: true,
        currentStars: repository.stargazers_count,
        updatedAt: now,
        today,
      });
    }

    await Promise.all([
      historyRepo.upsertDaily(rows),
      historyRepo.upsertSyncState({
        repoKey: key,
        backfillStatus: status,
        nextPage,
        oldestSeenStarredAt,
        lastSyncedAt: now,
        lastError: null,
        updatedAt: now,
      }),
    ]);

    return {
      meta: {
        repoKey: key,
        fullName: repository.full_name,
        latestStars: repository.stargazers_count,
        backfillStatus: status,
        lastSyncedAt: now,
        nextPage,
        historyMode: "exact",
        lastError: null,
      },
      points: rows.map((row) => ({
        date: row.day,
        totalStars: row.totalStars,
        starsGained: row.starsGained,
      })),
    };
  } catch (error) {
    return handleSyncError(
      error,
      repoRef,
      key,
      config,
      historyRepo,
      now,
      nextPage,
      oldestSeenStarredAt,
      syncState,
      existingRows,
      repository
    );
  }
}

function aggregateRepoHistory(
  histories: Record<string, GitHubStarsHistoryPoint[]>,
  range: TimeRange
): GitHubStarsHistoryPoint[] {
  const totals = new Map<string, GitHubStarsHistoryPoint>();

  for (const points of Object.values(histories)) {
    for (const point of applyRange(points, range)) {
      const current = totals.get(point.date);
      if (current) {
        current.totalStars += point.totalStars;
        current.starsGained += point.starsGained;
      } else {
        totals.set(point.date, { ...point });
      }
    }
  }

  return [...totals.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export async function fetchGitHubStarsHistory(
  repos: RepoRef[],
  range: TimeRange,
  ctx: DataSourceContext,
  options?: { syncMode?: GitHubStarsSyncMode; timeZone?: string }
): Promise<GitHubStarsHistoryData> {
  if (repos.length === 0) {
    return {
      aggregateDaily: [],
      repoDaily: {},
      aggregateAddedDaily: [],
      repoAddedDaily: {},
      repos: [],
      latestSyncAt: null,
    };
  }

  const historyRepo = await getHistoryRepo(ctx);
  const creds = await ctx.resolveCredential("github");
  const token = creds?.token ?? creds?.accessToken ?? "";
  const config: GitHubConfig = { token };
  const syncMode = options?.syncMode ?? "incremental";
  const timeZone = options?.timeZone ?? "UTC";
  const { start } = getTimeRangeWindow(range, timeZone);
  const rangeStartAt = Math.floor(start.getTime() / 1000);

  const results = await Promise.allSettled(
    repos.map((repo) => syncSingleRepo(repo, config, historyRepo, syncMode))
  );

  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof syncSingleRepo>>> =>
      result.status === "fulfilled"
  );

  if (fulfilled.length === 0) {
    throw new Error("All GitHub star history syncs failed");
  }

  const repoKeys = fulfilled.map(({ value }) => value.meta.repoKey);
  const trackingStates = await historyRepo.getTrackingStates(repoKeys);
  const trackingByRepo = new Map(trackingStates.map((row) => [row.repoKey, row]));
  const earliestTrackingStart = trackingStates.reduce<number | null>((earliest, row) => {
    if (row.trackingStartedAt == null) return earliest;
    if (earliest == null || row.trackingStartedAt < earliest) return row.trackingStartedAt;
    return earliest;
  }, null);
  const starEvents = await historyRepo.getStarEvents(repoKeys, {
    occurredAfter: earliestTrackingStart ?? rangeStartAt,
  });
  const eventsByRepo = new Map<string, GitHubRepoStarEventRow[]>();
  for (const event of starEvents) {
    const current = eventsByRepo.get(event.repoKey);
    if (current) current.push(event);
    else eventsByRepo.set(event.repoKey, [event]);
  }

  const repoDaily = Object.fromEntries(
    fulfilled.map(({ value }) => [value.meta.repoKey, applyRange(value.points, range)])
  );
  const repoAddedDaily = Object.fromEntries(
    fulfilled.map(({ value }) => [
      value.meta.repoKey,
      buildAddedPoints(eventsByRepo.get(value.meta.repoKey) ?? [], range, timeZone),
    ])
  );

  const repoMeta = fulfilled
    .map(({ value }) => {
      const tracking = trackingByRepo.get(value.meta.repoKey) ?? null;
      const coverage = resolveCoverage(
        tracking,
        eventsByRepo.get(value.meta.repoKey) ?? [],
        value.meta.latestStars,
        rangeStartAt,
        timeZone
      );

      return {
        ...value.meta,
        trackingStartedAt: tracking?.trackingStartedAt ?? null,
        baselineStars: tracking?.baselineStars ?? null,
        lastWebhookAt: tracking?.lastWebhookAt ?? null,
        coverageStatus: coverage.status,
        coverageMessage: coverage.message,
      };
    })
    .sort((left, right) => {
      if (right.latestStars !== left.latestStars) return right.latestStars - left.latestStars;
      return left.fullName.localeCompare(right.fullName);
    });

  return {
    aggregateDaily: aggregateRepoHistory(
      Object.fromEntries(fulfilled.map(({ value }) => [value.meta.repoKey, value.points])),
      range
    ),
    repoDaily,
    aggregateAddedDaily: aggregateAddedHistory(repoAddedDaily),
    repoAddedDaily,
    repos: repoMeta,
    latestSyncAt: repoMeta.reduce<number | null>((latest, repo) => {
      if (repo.lastSyncedAt == null) return latest;
      if (latest == null || repo.lastSyncedAt > latest) return repo.lastSyncedAt;
      return latest;
    }, null),
  };
}
