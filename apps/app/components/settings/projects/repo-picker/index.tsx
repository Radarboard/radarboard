"use client";

import { useCredentials } from "@radarboard/hooks/use-credentials";
import { integrationRoute } from "@radarboard/integration-sdk/routes";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { ChevronRight, Folder, Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { RemoteServiceIcon } from "@/components/shared/remote-service-icon";
import { getServiceFaviconUrl } from "@/lib/service-favicons";

interface GitHubRepo {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  language: string | null;
  isPrivate: boolean;
  isFork: boolean;
}

interface GitHubDir {
  name: string;
  path: string;
}

interface RepoPickerProps {
  currentRepo: { owner: string; repo: string; path?: string } | null;
  onSelect: (repo: { owner: string; repo: string; path?: string } | null) => void;
}

type RepoPickerUiState = {
  browserPath: string;
  debouncedSearch: string;
  pathInput: string;
  search: string;
  showBrowser: boolean;
};

function RepoBrowser({
  browserDirs,
  browserLoading,
  browserPath,
  onNavigate,
  onReset,
  onSelectDir,
}: {
  browserDirs: GitHubDir[];
  browserLoading: boolean;
  browserPath: string;
  onNavigate: (dirPath: string) => void;
  onReset: () => void;
  onSelectDir: (dirPath: string) => void;
}) {
  const breadcrumbs = browserPath ? browserPath.split("/") : [];
  const visibleDirs = browserDirs.filter((dir) => !dir.name.startsWith("."));

  return (
    <div className="overflow-hidden rounded-item border border-border bg-background">
      <div className="flex items-center gap-1 border-border border-b px-2.5 py-1 font-mono text-dim text-w-sm">
        <Button
          type="button"
          variant="ghost-link"
          size="xs"
          spacing="none"
          uppercase={false}
          onClick={onReset}
          className="hover:text-foreground-secondary"
        >
          root
        </Button>
        {breadcrumbs.map((segment, i) => {
          const fullPath = breadcrumbs.slice(0, i + 1).join("/");
          return (
            <span key={fullPath} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <Button
                type="button"
                variant="ghost-link"
                spacing="none"
                uppercase={false}
                onClick={() => onNavigate(fullPath)}
                className="hover:text-foreground-secondary"
              >
                {segment}
              </Button>
            </span>
          );
        })}
      </div>

      <div className="scrollbar-thin max-h-[160px] overflow-y-auto">
        {browserLoading ? (
          <div className="flex items-center justify-center py-2.5 text-dim">
            <Loader2 className="icon-sm animate-spin" />
          </div>
        ) : null}

        {!browserLoading && visibleDirs.length === 0 ? (
          <div className="py-2.5 text-center font-mono text-dim text-w-sm">
            No subdirectories found.
          </div>
        ) : null}

        {!browserLoading
          ? visibleDirs.map((dir) => (
              <div
                key={dir.path}
                className="flex items-center border-secondary border-b px-2.5 py-1 last:border-0"
              >
                <Button
                  type="button"
                  variant="ghost-link"
                  size="xs"
                  spacing="none"
                  uppercase={false}
                  onClick={() => onNavigate(dir.path)}
                  className="flex min-w-0 flex-1 items-center justify-start gap-2 text-left font-mono text-foreground-secondary text-w-sm hover:text-foreground"
                >
                  <Folder className="h-3.5 w-3.5 text-dim" />
                  <span className="truncate">{dir.name}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onSelectDir(dir.path)}
                  className="uppercase-none h-5 px-1.5 font-mono text-dim text-w-sm hover:text-foreground-secondary"
                >
                  Use
                </Button>
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

function RepoList({
  loading,
  repos,
  search,
  onSearchChange,
  onSelect,
}: {
  loading: boolean;
  repos: GitHubRepo[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (repo: GitHubRepo) => void;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-item border border-border bg-background">
      <div className="relative border-border border-b">
        <Search className="icon-xs absolute top-1/2 left-2.5 -translate-y-1/2 text-dim" />
        <Input
          type="text"
          placeholder="Search your repos..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full rounded-none border-none py-2 pr-3 pl-8 focus-visible:ring-0"
        />
      </div>

      <div className="scrollbar-thin max-h-[200px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-4 text-dim">
            <Loader2 className="icon-sm animate-spin" />
          </div>
        ) : null}

        {!loading && repos.length === 0 ? (
          <div className="py-4 text-center font-mono text-dim text-w-sm">
            {search ? "No repos match your search." : "No repos found."}
          </div>
        ) : null}

        {!loading
          ? repos.map((repo) => (
              <Button
                key={repo.fullName}
                type="button"
                variant="ghost"
                onClick={() => onSelect(repo)}
                className="uppercase-none h-auto w-full flex-col items-start rounded-none border-secondary border-b px-3 py-2 text-left font-sans transition-colors last:border-0 hover:bg-muted"
              >
                <div className="flex w-full min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-mono text-foreground-secondary text-w-sm">
                    {repo.fullName}
                  </span>
                  <div className="flex shrink-0 items-center gap-2 font-mono text-dim text-w-sm">
                    {repo.language ? <span>{repo.language}</span> : null}
                    <span>{repo.stars.toLocaleString()} stars</span>
                  </div>
                </div>
                {repo.description ? (
                  <div className="mt-0.5 w-full truncate font-mono text-dim text-w-sm">
                    {repo.description}
                  </div>
                ) : null}
              </Button>
            ))
          : null}
      </div>
    </div>
  );
}

async function githubFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return (await res.json()) as T;
}

export function RepoPicker({ currentRepo, onSelect }: RepoPickerProps) {
  const { connectedKeys } = useCredentials();
  const isGithubConnected = connectedKeys.includes("github");
  const faviconUrl = getServiceFaviconUrl("https://github.com", 32);
  const [ui, setUi] = useState<RepoPickerUiState>({
    browserPath: "",
    debouncedSearch: "",
    pathInput: currentRepo?.path ?? "",
    search: "",
    showBrowser: false,
  });
  const { browserPath, debouncedSearch, pathInput, search, showBrowser } = ui;

  // Sync pathInput when currentRepo changes externally
  useEffect(() => {
    setUi((current) => ({ ...current, pathInput: currentRepo?.path ?? "" }));
  }, [currentRepo?.path]);

  // Detect monorepo when a repo is selected
  const monorepoDetectKey = (() => {
    if (!currentRepo || currentRepo.path) return null;
    const params = new URLSearchParams({
      owner: currentRepo.owner,
      repo: currentRepo.repo,
    });
    return `${integrationRoute("github", "contents")}?${params.toString()}`;
  })();

  const { data: monorepoData, isLoading: detectingMonorepo } = useSWR(
    monorepoDetectKey,
    githubFetcher<{ isMonorepo?: boolean }>
  );
  const isMonorepo = currentRepo?.path ? true : (monorepoData?.isMonorepo ?? null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(
      () => setUi((current) => ({ ...current, debouncedSearch: current.search })),
      300
    );
    return () => clearTimeout(timer);
  }, [search]);

  // Debounce path input and update parent
  useEffect(() => {
    if (!currentRepo) return;
    const timer = setTimeout(() => {
      const normalizedPath = pathInput.trim().replace(/^\/+|\/+$/g, "") || undefined;
      if (normalizedPath === currentRepo.path) return;
      onSelect({ owner: currentRepo.owner, repo: currentRepo.repo, path: normalizedPath });
    }, 500);
    return () => clearTimeout(timer);
  }, [pathInput, currentRepo, onSelect]);

  // Fetch repos whenever the picker is visible (no current repo) and GitHub is connected
  const reposKey = (() => {
    if (currentRepo || !isGithubConnected) return null;
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) {
      params.set("q", debouncedSearch.trim());
    }
    return `${integrationRoute("github", "repos")}?${params.toString()}`;
  })();

  const { data: reposData, isLoading: loading } = useSWR(
    reposKey,
    githubFetcher<{ repos?: GitHubRepo[] }>
  );
  const repos = reposData?.repos ?? [];

  // Fetch directories for browser
  const browserKey = (() => {
    if (!showBrowser || !currentRepo) return null;
    const params = new URLSearchParams({
      owner: currentRepo.owner,
      repo: currentRepo.repo,
    });
    if (browserPath) params.set("path", browserPath);
    return `${integrationRoute("github", "contents")}?${params.toString()}`;
  })();

  const { data: browserData, isLoading: browserLoading } = useSWR(
    browserKey,
    githubFetcher<{ directories?: GitHubDir[] }>
  );
  const browserDirs = browserData?.directories ?? [];

  const handleSelect = useCallback(
    (repo: GitHubRepo) => {
      onSelect({ owner: repo.owner, repo: repo.repo });
      setUi({
        browserPath: "",
        debouncedSearch: "",
        pathInput: "",
        search: "",
        showBrowser: false,
      });
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    onSelect(null);
    setUi((current) => ({
      ...current,
      browserPath: "",
      pathInput: "",
      showBrowser: false,
    }));
  }, [onSelect]);

  const handleSelectDir = useCallback((dirPath: string) => {
    setUi((current) => ({
      ...current,
      browserPath: "",
      pathInput: dirPath,
      showBrowser: false,
    }));
  }, []);

  const handleBrowseNavigate = useCallback((dirPath: string) => {
    setUi((current) => ({ ...current, browserPath: dirPath }));
  }, []);

  if (!isGithubConnected) {
    return (
      <div className="py-1 font-mono text-dim text-w-sm">
        Connect GitHub in Integrations to link a repo.
      </div>
    );
  }

  // Repo selected — show chip + monorepo path config if detected
  if (currentRepo) {
    const showPathConfig = isMonorepo === true;

    return (
      <div className="w-full max-w-3xl space-y-1.5">
        {/* Repo chip */}
        <div className="flex items-center gap-2 rounded-item border border-border bg-secondary px-2.5 py-1.5">
          {faviconUrl && (
            <RemoteServiceIcon src={faviconUrl} alt="" size={14} className="rounded-item" />
          )}
          <span className="flex-1 font-mono text-foreground-secondary text-w-sm">
            {currentRepo.owner}/{currentRepo.repo}
            {currentRepo.path && <span className="text-dim"> / {currentRepo.path}</span>}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="icon-base uppercase-none text-dim transition-colors hover:bg-transparent hover:text-destructive"
            aria-label="Remove GitHub repo"
          >
            <X className="icon-xs" />
          </Button>
        </div>

        {/* Monorepo detection loading */}
        {detectingMonorepo && (
          <div className="flex items-center gap-1.5 font-mono text-dim text-w-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking repository structure...
          </div>
        )}

        {/* Path input — only shown for monorepos */}
        {showPathConfig && (
          <>
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                placeholder="Scope to path (e.g., apps/my-app)"
                value={pathInput}
                onChange={(e) =>
                  setUi((current) => ({
                    ...current,
                    pathInput: e.target.value,
                  }))
                }
                size="sm"
                className="flex-1 font-mono text-w-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setUi((current) => ({
                    ...current,
                    browserPath: "",
                    showBrowser: !current.showBrowser,
                  }));
                }}
                className="uppercase-none h-6 shrink-0 font-mono text-w-sm"
              >
                <Folder className="mr-1 h-3 w-3" />
                Browse
              </Button>
            </div>

            {/* Directory browser */}
            {showBrowser ? (
              <RepoBrowser
                browserDirs={browserDirs}
                browserLoading={browserLoading}
                browserPath={browserPath}
                onNavigate={handleBrowseNavigate}
                onReset={() => setUi((current) => ({ ...current, browserPath: "" }))}
                onSelectDir={handleSelectDir}
              />
            ) : null}
          </>
        )}
      </div>
    );
  }

  // No repo selected — show search + list directly
  return (
    <RepoList
      loading={Boolean(loading)}
      repos={repos}
      search={search}
      onSearchChange={(value) => setUi((current) => ({ ...current, search: value }))}
      onSelect={handleSelect}
    />
  );
}
