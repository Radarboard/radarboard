"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { Loader2, RefreshCwIcon, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  buildRepoPickerUrl,
  type GitHubRepoPickerItem,
  resolveWidgetGitHubRepoSelections,
  sortGitHubRepoPickerItems,
  type WidgetGitHubRepoSelection,
} from "./github-repo-multi-picker-utils";

interface GitHubRepoResponse {
  repos?: GitHubRepoPickerItem[];
}

interface GitHubRepoMultiPickerProps {
  isGitHubConnected: boolean;
  selectedRepos: WidgetGitHubRepoSelection[];
  excludedRepos?: WidgetGitHubRepoSelection[];
  onChange: (repos: WidgetGitHubRepoSelection[]) => void;
}

const EMPTY_REPOS: WidgetGitHubRepoSelection[] = [];

function fetchRepos(url: string): Promise<GitHubRepoResponse> {
  return fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`GitHub repos API returned ${response.status}`);
    }

    return response.json() as Promise<GitHubRepoResponse>;
  });
}

function repoKey(repo: WidgetGitHubRepoSelection): string {
  return `${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;
}

export function GitHubRepoMultiPicker({
  isGitHubConnected,
  selectedRepos,
  excludedRepos = EMPTY_REPOS,
  onChange,
}: GitHubRepoMultiPickerProps) {
  const [search, setSearch] = useState("");
  const key = isGitHubConnected ? buildRepoPickerUrl(search) : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetchRepos, {
    revalidateOnFocus: false,
    revalidateOnMount: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
    dedupingInterval: 15 * 60 * 1000,
  });

  const selectedRepoKeys = useMemo(
    () => new Set(selectedRepos.map((repo) => repoKey(repo))),
    [selectedRepos]
  );
  const excludedRepoKeys = useMemo(
    () => new Set(excludedRepos.map((repo) => repoKey(repo))),
    [excludedRepos]
  );
  const availableRepos = useMemo(
    () =>
      sortGitHubRepoPickerItems(
        (data?.repos ?? []).filter((repo) => {
          const key = repoKey({ owner: repo.owner, repo: repo.repo });
          return !selectedRepoKeys.has(key) && !excludedRepoKeys.has(key);
        })
      ),
    [data?.repos, selectedRepoKeys, excludedRepoKeys]
  );

  async function handleRefresh() {
    if (!key) return;
    const fresh = await fetchRepos(key);
    await mutate(fresh, { revalidate: false });
  }

  function handleSelect(repo: GitHubRepoPickerItem) {
    const next = resolveWidgetGitHubRepoSelections([...selectedRepos, repo]);
    onChange(next);
    setSearch("");
  }

  function handleRemove(repo: WidgetGitHubRepoSelection) {
    onChange(selectedRepos.filter((item) => repoKey(item) !== repoKey(repo)));
  }

  if (!isGitHubConnected) {
    return (
      <div className="py-1 font-mono text-dim text-w-sm">
        Connect GitHub in Integrations to add repositories.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selectedRepos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedRepos.map((repo) => (
            <div
              key={`${repo.owner}/${repo.repo}`}
              className="flex max-w-full items-center gap-2 rounded-item border border-border bg-secondary px-3 py-1.5"
            >
              <span className="min-w-0 truncate font-mono text-foreground-secondary text-w-sm">
                {repo.owner}/{repo.repo}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(repo)}
                className="icon-sm uppercase-none shrink-0 p-0 text-dim transition-colors hover:bg-transparent hover:text-destructive"
                aria-label={`Remove ${repo.owner}/${repo.repo}`}
              >
                <X className="icon-xs" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-item border border-border bg-surface">
        <div className="relative flex items-center gap-2 border-border border-b pr-2">
          <Search className="icon-xs absolute top-1/2 left-2.5 -translate-y-1/2 text-dim" />
          <Input
            type="text"
            placeholder="Search your repos..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 w-full min-w-0 rounded-none border-none bg-transparent py-2 pr-3 pl-8 focus-visible:ring-0"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleRefresh()}
                className="uppercase-none flex h-auto shrink-0 items-center gap-1 px-1.5 py-1 font-mono text-dim text-w-sm transition-colors hover:bg-transparent hover:text-foreground-secondary"
                aria-label="Refresh repositories"
              >
                <RefreshCwIcon className={cn("icon-xs", isValidating && "animate-spin")} />
                <span>Refresh</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh repositories</TooltipContent>
          </Tooltip>
        </div>

        <div className="scrollbar-thin max-h-[220px] overflow-y-auto overflow-x-hidden">
          {Boolean(isLoading) && (
            <div className="flex items-center justify-center py-4 text-dim">
              <Loader2 className="icon-sm animate-spin" />
            </div>
          )}

          {!isLoading && error && (
            <div className="px-3 py-4 text-center font-mono text-destructive text-w-sm">
              Unable to load repositories.
            </div>
          )}

          {!isLoading && !error && availableRepos.length === 0 && (
            <div className="px-3 py-4 text-center font-mono text-dim text-w-sm">
              {(() => {
                if (search.trim().length > 0) return "No repos match your search.";
                if (data?.repos?.length) return "All available repos are already linked or added.";
                return "No repos found.";
              })()}
            </div>
          )}

          {!isLoading &&
            !error &&
            availableRepos.map((repo) => (
              <Button
                key={repo.fullName}
                type="button"
                variant="ghost"
                onClick={() => handleSelect(repo)}
                className="uppercase-none h-auto w-full min-w-0 flex-col items-start rounded-none border-secondary border-b px-3 py-2 text-left font-sans transition-colors last:border-0 hover:bg-muted"
              >
                <div
                  className="min-w-0 overflow-hidden font-mono text-foreground-secondary text-w-sm leading-4"
                  style={{
                    display: "-webkit-box",
                    // biome-ignore lint/style/useNamingConvention: React vendor-prefixed CSS properties require PascalCase
                    WebkitLineClamp: 2,
                    // biome-ignore lint/style/useNamingConvention: React vendor-prefixed CSS properties require PascalCase
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {repo.fullName}
                </div>
                <div className="mt-1 font-mono text-dim text-w-sm">
                  {repo.stars.toLocaleString()} stars
                </div>
                {Boolean(repo.description) && (
                  <div className="mt-0.5 w-full truncate font-mono text-dim/60 text-w-sm">
                    {repo.description}
                  </div>
                )}
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}
