// @vitest-environment jsdom

import { Dialog } from "@radarboard/ui/app-dialog";
import { WidgetModalDialogContent } from "@radarboard/widget-engine/widget-modal";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { starsDescriptor } from "..";
import { GitHubStarsRepoDetail } from "../components/github-stars-repo-detail";
import {
  buildGitHubStarsHistoryUrl,
  buildGitHubStarsUrl,
  extractSelectedReposFromConfig,
} from "../repo-query";
import { ROUTES } from "../routes";

vi.mock("../hooks/use-github-stars-history", () => ({
  useGitHubStarsHistory: () => ({
    data: {
      aggregateDaily: [
        { date: "2026-03-18", totalStars: 4100, starsGained: 10 },
        { date: "2026-03-19", totalStars: 4180, starsGained: 80 },
        { date: "2026-03-20", totalStars: 4200, starsGained: 20 },
      ],
      aggregateAddedDaily: [
        { date: "2026-03-18", count: 10 },
        { date: "2026-03-19", count: 80 },
        { date: "2026-03-20", count: 20 },
      ],
      repoDaily: {
        "Radarboard/radarboard": [
          { date: "2026-03-18", totalStars: 4100, starsGained: 10 },
          { date: "2026-03-19", totalStars: 4180, starsGained: 80 },
          { date: "2026-03-20", totalStars: 4200, starsGained: 20 },
        ],
      },
      repoAddedDaily: {
        "Radarboard/radarboard": [
          { date: "2026-03-18", count: 10 },
          { date: "2026-03-19", count: 80 },
          { date: "2026-03-20", count: 20 },
        ],
      },
      repos: [
        {
          repoKey: "Radarboard/radarboard",
          fullName: "Radarboard/radarboard",
          latestStars: 4200,
          backfillStatus: "complete",
          lastSyncedAt: 1_700_000_000,
          coverageStatus: "full",
          coverageMessage: "Tracking healthy",
        },
      ],
      latestSyncAt: 1_700_000_000,
      _fetchedAt: 1_700_000_000,
    },
    fetchedAt: 1_700_000_000,
    loading: false,
    error: null,
    refetch: vi.fn(async () => {}),
  }),
}));

vi.mock("@radarboard/charts/line-chart", () => ({
  MonitorLineChart: ({
    height,
    showXAxis,
    showYAxis,
    yDomain,
  }: {
    height?: number;
    showXAxis?: boolean;
    showYAxis?: boolean;
    yDomain?: [number, number];
  }) =>
    createElement("div", {
      "data-testid": "stars-line-chart",
      "data-height": String(height ?? ""),
      "data-show-x-axis": String(showXAxis ?? true),
      "data-show-y-axis": String(showYAxis ?? false),
      "data-y-domain": Array.isArray(yDomain) ? yDomain.join(":") : "auto",
    }),
}));

describe("starsDescriptor", () => {
  it("keeps the GitHub auth contract and widget surface available", () => {
    expect(starsDescriptor.requiredIntegrations).toEqual([]);
    expect(starsDescriptor.polling).toEqual({ sourceIds: ["github-stars"] });
    expect(starsDescriptor.component).toBeTypeOf("function");
    expect(starsDescriptor.expandedComponent).toBeTypeOf("function");
    expect(starsDescriptor.auth?.id).toBe("github");
  });

  it("builds compact and history routes with deduped selected repos", () => {
    const selectedRepos = extractSelectedReposFromConfig({
      selectedRepos: [
        { owner: "OpenAI", repo: "codex" },
        { owner: "thedaviddias", repo: "radarboard" },
        { owner: "openai", repo: "codex" },
        { owner: "bad/repo", repo: "oops" },
        { owner: "", repo: "missing" },
      ],
    });

    expect(selectedRepos).toEqual([
      { owner: "OpenAI", repo: "codex" },
      { owner: "thedaviddias", repo: "radarboard" },
    ]);

    expect(buildGitHubStarsUrl("goshuin-atlas", selectedRepos)).toBe(
      `${ROUTES.githubStars}?project=goshuin-atlas&repo=OpenAI%2Fcodex&repo=thedaviddias%2Fradarboard`
    );
    expect(buildGitHubStarsHistoryUrl("goshuin-atlas", "30d", "UTC", selectedRepos)).toBe(
      `${ROUTES.githubStarsHistory}?range=30d&project=goshuin-atlas&timezone=UTC&repo=OpenAI%2Fcodex&repo=thedaviddias%2Fradarboard`
    );
  });

  it("returns base routes when no repo config is present and supports refresh-only history urls", () => {
    expect(extractSelectedReposFromConfig(undefined)).toEqual([]);
    expect(extractSelectedReposFromConfig({ selectedRepos: "nope" as unknown })).toEqual([]);
    expect(buildGitHubStarsUrl(null, [{ owner: "", repo: "missing" }, null], true)).toBe(
      `${ROUTES.githubStars}?refresh=1`
    );
    expect(buildGitHubStarsUrl(null, [])).toBe(ROUTES.githubStars);
    expect(buildGitHubStarsHistoryUrl(null, "all", null, [], true)).toBe(
      `${ROUTES.githubStarsHistory}?range=all&refresh=1`
    );
  });

  it("renders the repo detail chart and metadata in a small modal footprint", async () => {
    const repo = {
      fullName: "Radarboard/radarboard",
      description: "Dashboard monorepo",
      language: "TypeScript",
      htmlUrl: "https://github.com/Radarboard/radarboard",
      stars: 4200,
      forks: 180,
      openIssues: 12,
      watchers: 75,
      repoKey: "Radarboard/radarboard",
      historyPoints: [
        { date: "2026-03-18", totalStars: 4100, starsGained: 10 },
        { date: "2026-03-19", totalStars: 4180, starsGained: 80 },
        { date: "2026-03-20", totalStars: 4200, starsGained: 20 },
      ],
      starsDeltaLabel: "+110",
      updatedAt: new Date().toISOString(),
    };

    render(
      createElement(
        Dialog,
        { open: true },
        createElement(
          WidgetModalDialogContent,
          {
            widgetId: starsDescriptor.id,
            modalId: "github.stars-repo",
            defaultSize: "sm",
            showSizeToggle: false,
          },
          createElement(GitHubStarsRepoDetail, {
            repo,
            projectSlug: "goshuin-atlas",
          })
        )
      )
    );

    expect(await screen.findByText("Radarboard/radarboard")).toBeTruthy();
    expect(screen.getByText("Dashboard monorepo")).toBeTruthy();
    expect(screen.getByText("TypeScript")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View on GitHub →" }).getAttribute("href")).toBe(
      "https://github.com/Radarboard/radarboard"
    );

    const chart = await screen.findByTestId("stars-line-chart");
    expect(chart.getAttribute("data-height")).toBe("");
    expect(chart.getAttribute("data-show-x-axis")).toBe("false");
    expect(chart.getAttribute("data-show-y-axis")).toBe("false");
    expect(chart.getAttribute("data-y-domain")).toBe("auto");
  });
});
