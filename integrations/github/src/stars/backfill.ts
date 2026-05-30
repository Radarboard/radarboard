import type { DataSourceContext } from "@radarboard/integration-sdk/types";
import { githubStarsHistoryDataSource } from "../api/data-sources";

interface GitHubRepoRef {
  owner: string;
  repo: string;
}

interface BackfillGitHubStarsHistoryOptions {
  ctx: DataSourceContext;
  projectSlug?: string | null;
  selectedRepos?: GitHubRepoRef[];
  timeZone?: string;
}

export async function backfillGitHubStarsHistory({
  ctx,
  projectSlug = null,
  selectedRepos = [],
  timeZone = "UTC",
}: BackfillGitHubStarsHistoryOptions) {
  return (await githubStarsHistoryDataSource.fetch(
    {
      projectSlug,
      range: "all",
      timeZone,
      forceRefresh: true,
      selectedRepos,
      syncMode: "full",
    },
    ctx
  )) as {
    repos: Array<{ backfillStatus: string }>;
  };
}
