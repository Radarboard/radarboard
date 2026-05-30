import { afterEach, describe, expect, it, vi } from "vitest";

const fetchGitHubStarsHistory = vi.fn();

vi.mock("./star-history", () => ({
  fetchGitHubStarsHistory: (...args: unknown[]) => fetchGitHubStarsHistory(...args),
}));

import { githubStarsDataSource, githubStarsHistoryDataSource } from "./data-sources";

describe("githubStarsDataSource", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fetchGitHubStarsHistory.mockReset();
  });

  it("parses selected repos, ignores malformed values, and keeps cache keys order-stable", () => {
    const parsed = githubStarsDataSource.parseParams?.(
      new URLSearchParams([
        ["repo", "bad-value"],
        ["repo", "openai/codex"],
        ["repo", "OpenAI/codex"],
        ["repo", "owner/repo/extra"],
        ["repo", " Radarboard/radarboard "],
      ])
    );

    expect(parsed).toEqual({
      selectedRepos: [
        { owner: "openai", repo: "codex" },
        { owner: "Radarboard", repo: "radarboard" },
      ],
      syncMode: "incremental",
    });

    const firstKey = githubStarsDataSource.buildCacheKey?.({
      projectSlug: null,
      range: "30d",
      timeZone: "UTC",
      forceRefresh: false,
      selectedRepos: [
        { owner: "openai", repo: "codex" },
        { owner: "Radarboard", repo: "radarboard" },
      ],
    });
    const secondKey = githubStarsDataSource.buildCacheKey?.({
      projectSlug: null,
      range: "30d",
      timeZone: "UTC",
      forceRefresh: false,
      selectedRepos: [
        { owner: "Radarboard", repo: "radarboard" },
        { owner: "openai", repo: "codex" },
      ],
    });

    expect(firstKey).toBe(secondKey);
  });

  it("merges selected repos with project repos and dedupes overlaps", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/Radarboard/radarboard")) {
        return {
          ok: true,
          json: async () => ({
            stargazers_count: 4200,
            forks_count: 180,
            open_issues_count: 12,
            watchers_count: 75,
            full_name: "Radarboard/radarboard",
            description: "Dashboard monorepo",
            language: "TypeScript",
            html_url: "https://github.com/Radarboard/radarboard",
            updated_at: "2026-03-19T00:00:00.000Z",
            private: false,
          }),
        };
      }

      if (url.includes("/openai/codex")) {
        return {
          ok: true,
          json: async () => ({
            stargazers_count: 1000,
            forks_count: 50,
            open_issues_count: 3,
            watchers_count: 20,
            full_name: "openai/codex",
            description: "Agentic coding",
            language: "TypeScript",
            html_url: "https://github.com/openai/codex",
            updated_at: "2026-03-19T00:00:00.000Z",
            private: false,
          }),
        };
      }

      if (url.includes("/thedaviddias/secret-repo")) {
        return {
          ok: true,
          json: async () => ({
            stargazers_count: 99,
            forks_count: 10,
            open_issues_count: 1,
            watchers_count: 8,
            full_name: "thedaviddias/secret-repo",
            description: "Private repo",
            language: "TypeScript",
            html_url: "https://github.com/thedaviddias/secret-repo",
            updated_at: "2026-03-19T00:00:00.000Z",
            private: true,
          }),
        };
      }

      throw new Error(`Unexpected repo URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = (await githubStarsDataSource.fetch(
      {
        projectSlug: "goshuin-atlas",
        range: "30d",
        timeZone: "UTC",
        forceRefresh: false,
        selectedRepos: [
          { owner: "openai", repo: "codex" },
          { owner: "Radarboard", repo: "radarboard" },
        ],
      },
      {
        resolveCredential: vi.fn().mockResolvedValue({ token: "ghs_test" }),
        getProjectIntegrations: vi.fn().mockResolvedValue({}),
        getAllProjects: vi.fn().mockResolvedValue([
          {
            slug: "goshuin-atlas",
            name: "Goshuin Atlas",
            color: "#e63946",
            platforms: [
              {
                id: "goshuin-atlas-web",
                name: "Web",
                integrations: {
                  github: { owner: "Radarboard", repo: "radarboard", path: "apps/web" },
                },
              },
              {
                id: "goshuin-atlas-api",
                name: "API",
                integrations: {
                  github: { owner: "Radarboard", repo: "radarboard", path: "apps/api" },
                },
              },
              {
                id: "goshuin-atlas-private",
                name: "Private",
                integrations: {
                  github: { owner: "thedaviddias", repo: "secret-repo" },
                },
              },
            ],
          },
        ]),
      }
    )) as {
      totalStars: number;
      totalForks: number;
      repos: Array<{ fullName: string }>;
    };

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(data.totalStars).toBe(5200);
    expect(data.totalForks).toBe(230);
    expect(data.repos.map((repo) => repo.fullName)).toEqual([
      "Radarboard/radarboard",
      "openai/codex",
    ]);
    expect(data.repos).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ fullName: "thedaviddias/secret-repo" })])
    );
  });

  it("passes merged repo refs and range through to stars-history", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/Radarboard/radarboard")) {
        return {
          ok: true,
          json: async () => ({
            stargazers_count: 4200,
            forks_count: 180,
            open_issues_count: 12,
            watchers_count: 75,
            full_name: "Radarboard/radarboard",
            description: "Dashboard monorepo",
            language: "TypeScript",
            html_url: "https://github.com/Radarboard/radarboard",
            updated_at: "2026-03-19T00:00:00.000Z",
            private: false,
          }),
        };
      }

      if (url.includes("/openai/codex")) {
        return {
          ok: true,
          json: async () => ({
            stargazers_count: 1000,
            forks_count: 50,
            open_issues_count: 3,
            watchers_count: 20,
            full_name: "openai/codex",
            description: "Agentic coding",
            language: "TypeScript",
            html_url: "https://github.com/openai/codex",
            updated_at: "2026-03-19T00:00:00.000Z",
            private: false,
          }),
        };
      }

      if (url.includes("/thedaviddias/secret-repo")) {
        return {
          ok: true,
          json: async () => ({
            stargazers_count: 99,
            forks_count: 10,
            open_issues_count: 1,
            watchers_count: 8,
            full_name: "thedaviddias/secret-repo",
            description: "Private repo",
            language: "TypeScript",
            html_url: "https://github.com/thedaviddias/secret-repo",
            updated_at: "2026-03-19T00:00:00.000Z",
            private: true,
          }),
        };
      }

      throw new Error(`Unexpected repo URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    fetchGitHubStarsHistory.mockResolvedValue({
      aggregateDaily: [],
      repoDaily: {},
      aggregateAddedDaily: [],
      repoAddedDaily: {},
      repos: [],
      latestSyncAt: null,
    });

    await githubStarsHistoryDataSource.fetch(
      {
        projectSlug: "goshuin-atlas",
        range: "all",
        timeZone: "UTC",
        forceRefresh: true,
        selectedRepos: [
          { owner: "openai", repo: "codex" },
          { owner: "Radarboard", repo: "radarboard" },
        ],
      },
      {
        resolveCredential: vi.fn().mockResolvedValue({ token: "ghs_test" }),
        getProjectIntegrations: vi.fn().mockResolvedValue({}),
        getAllProjects: vi.fn().mockResolvedValue([
          {
            slug: "goshuin-atlas",
            name: "Goshuin Atlas",
            color: "#e63946",
            platforms: [
              {
                id: "goshuin-atlas-web",
                name: "Web",
                integrations: {
                  github: { owner: "Radarboard", repo: "radarboard", path: "apps/web" },
                },
              },
              {
                id: "goshuin-atlas-api",
                name: "API",
                integrations: {
                  github: { owner: "Radarboard", repo: "radarboard", path: "apps/api" },
                },
              },
              {
                id: "goshuin-atlas-private",
                name: "Private",
                integrations: {
                  github: { owner: "thedaviddias", repo: "secret-repo" },
                },
              },
            ],
          },
        ]),
        getGitHubStarHistoryRepo: vi.fn(),
      }
    );

    expect(fetchGitHubStarsHistory).toHaveBeenCalledWith(
      [
        { owner: "Radarboard", repo: "radarboard" },
        { owner: "openai", repo: "codex" },
      ],
      "all",
      expect.objectContaining({
        resolveCredential: expect.any(Function),
        getGitHubStarHistoryRepo: expect.any(Function),
      }),
      { syncMode: "incremental", timeZone: "UTC" }
    );
  });

  it("returns an empty result when only private repos are configured", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/thedaviddias/secret-repo")) {
        return {
          ok: true,
          json: async () => ({
            stargazers_count: 99,
            forks_count: 10,
            open_issues_count: 1,
            watchers_count: 8,
            full_name: "thedaviddias/secret-repo",
            description: "Private repo",
            language: "TypeScript",
            html_url: "https://github.com/thedaviddias/secret-repo",
            updated_at: "2026-03-19T00:00:00.000Z",
            private: true,
          }),
        };
      }

      throw new Error(`Unexpected repo URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = (await githubStarsDataSource.fetch(
      {
        projectSlug: "secret-project",
        range: "30d",
        timeZone: "UTC",
        forceRefresh: false,
        selectedRepos: [],
      },
      {
        resolveCredential: vi.fn().mockResolvedValue({ token: "ghs_test" }),
        getProjectIntegrations: vi.fn().mockResolvedValue({}),
        getAllProjects: vi.fn().mockResolvedValue([
          {
            slug: "secret-project",
            name: "Secret Project",
            color: "#111111",
            platforms: [
              {
                id: "secret-platform",
                name: "Secret",
                integrations: {
                  github: { owner: "thedaviddias", repo: "secret-repo" },
                },
              },
            ],
          },
        ]),
      }
    )) as {
      totalStars: number;
      totalForks: number;
      repos: Array<{ fullName: string }>;
    };

    expect(data.totalStars).toBe(0);
    expect(data.totalForks).toBe(0);
    expect(data.repos).toEqual([]);
  });
});
