import type {
  GitHubRepoStarDailyRow,
  GitHubRepoStarEventRow,
  GitHubRepoStarSyncStateRow,
  GitHubRepoStarTrackingRow,
  GitHubStarHistoryRepository,
  SupabaseConfig,
} from "@radarboard/types/database";

function toInFilter(values: string[]): string {
  return `in.(${values.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(",")})`;
}

function rowToDaily(row: Record<string, unknown>): GitHubRepoStarDailyRow {
  return {
    repoKey: row.repo_key as string,
    day: row.day as string,
    totalStars: row.total_stars as number,
    starsGained: row.stars_gained as number,
    source: row.source as string,
    updatedAt: row.updated_at as number,
  };
}

function rowToSyncState(row: Record<string, unknown>): GitHubRepoStarSyncStateRow {
  return {
    repoKey: row.repo_key as string,
    backfillStatus: row.backfill_status as GitHubRepoStarSyncStateRow["backfillStatus"],
    nextPage: (row.next_page as number | null) ?? null,
    oldestSeenStarredAt: (row.oldest_seen_starred_at as string | null) ?? null,
    lastSyncedAt: (row.last_synced_at as number | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    updatedAt: row.updated_at as number,
  };
}

function rowToStarEvent(row: Record<string, unknown>): GitHubRepoStarEventRow {
  return {
    sourceEventId: row.source_event_id as string,
    repoKey: row.repo_key as string,
    action: row.action as GitHubRepoStarEventRow["action"],
    userLogin: (row.user_login as string | null) ?? null,
    occurredAt: row.occurred_at as number,
    updatedAt: row.updated_at as number,
  };
}

function rowToTracking(row: Record<string, unknown>): GitHubRepoStarTrackingRow {
  return {
    repoKey: row.repo_key as string,
    trackingStartedAt: (row.tracking_started_at as number | null) ?? null,
    baselineStars: (row.baseline_stars as number | null) ?? null,
    lastWebhookAt: (row.last_webhook_at as number | null) ?? null,
    updatedAt: row.updated_at as number,
  };
}

export class SupabaseGitHubStarHistoryRepository implements GitHubStarHistoryRepository {
  private readonly url: string;
  private readonly headers: Record<string, string>;

  constructor(config: SupabaseConfig) {
    this.url = `${config.url}/rest/v1`;
    this.headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
    };
  }

  async listRepoKeys(): Promise<string[]> {
    const results = await Promise.all(
      [
        "github_repo_star_daily",
        "github_repo_star_sync_state",
        "github_repo_star_event",
        "github_repo_star_tracking",
      ].map(async (table) => {
        const url = new URL(`${this.url}/${table}`);
        url.searchParams.set("select", "repo_key");
        const response = await fetch(url.toString(), { headers: this.headers });
        if (!response.ok) return [] as string[];
        const rows = (await response.json()) as Array<Record<string, unknown>>;
        return rows
          .map((row) => row.repo_key as string | undefined)
          .filter((repoKey): repoKey is string => Boolean(repoKey));
      })
    );

    return [...new Set(results.flat())].sort((left, right) => left.localeCompare(right));
  }

  async getDaily(
    repoKeys: string[],
    options: { fromDay?: string | null; toDay?: string | null } = {}
  ): Promise<GitHubRepoStarDailyRow[]> {
    if (repoKeys.length === 0) return [];

    const url = new URL(`${this.url}/github_repo_star_daily`);
    url.searchParams.set("select", "repo_key,day,total_stars,stars_gained,source,updated_at");
    url.searchParams.set("repo_key", toInFilter(repoKeys));
    url.searchParams.set("order", "repo_key.asc,day.asc");
    if (options.fromDay) url.searchParams.set("day", `gte.${options.fromDay}`);
    if (options.toDay) url.searchParams.append("day", `lte.${options.toDay}`);

    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map(rowToDaily);
  }

  async upsertDaily(rows: GitHubRepoStarDailyRow[]): Promise<void> {
    if (rows.length === 0) return;

    const url = new URL(`${this.url}/github_repo_star_daily`);
    url.searchParams.set("on_conflict", "repo_key,day");

    await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(
        rows.map((row) => ({
          repo_key: row.repoKey,
          day: row.day,
          total_stars: row.totalStars,
          stars_gained: row.starsGained,
          source: row.source,
          updated_at: row.updatedAt,
        }))
      ),
    });
  }

  async getSyncStates(repoKeys: string[]): Promise<GitHubRepoStarSyncStateRow[]> {
    if (repoKeys.length === 0) return [];

    const url = new URL(`${this.url}/github_repo_star_sync_state`);
    url.searchParams.set(
      "select",
      "repo_key,backfill_status,next_page,oldest_seen_starred_at,last_synced_at,last_error,updated_at"
    );
    url.searchParams.set("repo_key", toInFilter(repoKeys));
    url.searchParams.set("order", "repo_key.asc");

    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map(rowToSyncState);
  }

  async upsertSyncState(row: GitHubRepoStarSyncStateRow): Promise<void> {
    const url = new URL(`${this.url}/github_repo_star_sync_state`);
    url.searchParams.set("on_conflict", "repo_key");

    await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        repo_key: row.repoKey,
        backfill_status: row.backfillStatus,
        next_page: row.nextPage,
        oldest_seen_starred_at: row.oldestSeenStarredAt,
        last_synced_at: row.lastSyncedAt,
        last_error: row.lastError,
        updated_at: row.updatedAt,
      }),
    });
  }

  async getStarEvents(
    repoKeys: string[],
    options: {
      actions?: Array<GitHubRepoStarEventRow["action"]>;
      occurredAfter?: number | null;
      occurredBefore?: number | null;
    } = {}
  ): Promise<GitHubRepoStarEventRow[]> {
    if (repoKeys.length === 0) return [];

    const url = new URL(`${this.url}/github_repo_star_event`);
    url.searchParams.set(
      "select",
      "source_event_id,repo_key,action,user_login,occurred_at,updated_at"
    );
    url.searchParams.set("repo_key", toInFilter(repoKeys));
    url.searchParams.set("order", "repo_key.asc,occurred_at.asc");
    if (options.actions?.length) {
      url.searchParams.set("action", toInFilter(options.actions));
    }
    if (options.occurredAfter != null) {
      url.searchParams.set("occurred_at", `gte.${options.occurredAfter}`);
    }
    if (options.occurredBefore != null) {
      url.searchParams.append("occurred_at", `lte.${options.occurredBefore}`);
    }

    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map(rowToStarEvent);
  }

  async upsertStarEvents(rows: GitHubRepoStarEventRow[]): Promise<void> {
    if (rows.length === 0) return;

    const url = new URL(`${this.url}/github_repo_star_event`);
    url.searchParams.set("on_conflict", "source_event_id");

    await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(
        rows.map((row) => ({
          source_event_id: row.sourceEventId,
          repo_key: row.repoKey,
          action: row.action,
          user_login: row.userLogin,
          occurred_at: row.occurredAt,
          updated_at: row.updatedAt,
        }))
      ),
    });
  }

  async getTrackingStates(repoKeys: string[]): Promise<GitHubRepoStarTrackingRow[]> {
    if (repoKeys.length === 0) return [];

    const url = new URL(`${this.url}/github_repo_star_tracking`);
    url.searchParams.set(
      "select",
      "repo_key,tracking_started_at,baseline_stars,last_webhook_at,updated_at"
    );
    url.searchParams.set("repo_key", toInFilter(repoKeys));
    url.searchParams.set("order", "repo_key.asc");

    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map(rowToTracking);
  }

  async upsertTrackingState(row: GitHubRepoStarTrackingRow): Promise<void> {
    const url = new URL(`${this.url}/github_repo_star_tracking`);
    url.searchParams.set("on_conflict", "repo_key");

    await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        repo_key: row.repoKey,
        tracking_started_at: row.trackingStartedAt,
        baseline_stars: row.baselineStars,
        last_webhook_at: row.lastWebhookAt,
        updated_at: row.updatedAt,
      }),
    });
  }

  async clearAll(): Promise<void> {
    await Promise.all(
      [
        "github_repo_star_daily",
        "github_repo_star_sync_state",
        "github_repo_star_event",
        "github_repo_star_tracking",
      ].map(async (table) => {
        const url = new URL(`${this.url}/${table}`);
        url.searchParams.set("repo_key", "not.is.null");
        await fetch(url.toString(), {
          method: "DELETE",
          headers: {
            ...this.headers,
            Prefer: "return=minimal",
          },
        });
      })
    );
  }
}
