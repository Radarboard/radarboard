// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";
import { GitHubActivityModule, GitHubActivityModuleExpanded } from "..";

const mockUseGithubOpenPrs = vi.fn();
const mockUseGithubOpenIssues = vi.fn();

vi.mock("../hooks/use-github-open-prs", () => ({
  useGithubOpenPrs: (...args: unknown[]) => mockUseGithubOpenPrs(...args),
}));

vi.mock("../hooks/use-github-open-issues", () => ({
  useGithubOpenIssues: (...args: unknown[]) => mockUseGithubOpenIssues(...args),
}));

const PRS = [
  {
    id: 41,
    number: 41,
    title: "Add template detail selection runtime",
    htmlUrl: "https://github.com/acme/radarboard/pull/41",
    user: { login: "thedaviddias", avatarUrl: "" },
    labels: [{ name: "widgets", color: "5b8af5" }],
    repo: "acme/radarboard",
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
];

const ISSUES = [
  {
    id: 77,
    number: 77,
    title: "OAuth callback breaks on missing provider",
    htmlUrl: "https://github.com/acme/dashboard/issues/77",
    user: { login: "ops-bot[bot]", avatarUrl: "" },
    labels: [{ name: "bug", color: "e63946" }],
    repo: "acme/dashboard",
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
    updatedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
];

describe("GitHub Activity widget", () => {
  beforeEach(() => {
    mockUseGithubOpenPrs.mockReset();
    mockUseGithubOpenIssues.mockReset();

    mockUseGithubOpenPrs.mockReturnValue({
      items: PRS,
      loading: false,
      configured: true,
      fetchedAt: 1_700_000_000,
      refetch: vi.fn(async () => {}),
    });

    mockUseGithubOpenIssues.mockReturnValue({
      items: ISSUES,
      loading: false,
      configured: true,
      fetchedAt: 1_700_000_100,
      refetch: vi.fn(async () => {}),
    });
  });

  it("renders compact rows with shared segmented tabs and external links", async () => {
    const user = userEvent.setup();
    render(createElement(GitHubActivityModule, { projectSlug: "goshuin-atlas", config: {} }));

    const prsTab = screen.getByRole("tab", { name: /PRs/i });
    expect(prsTab.getAttribute("data-state")).toBe("active");

    expect(
      (await screen.findAllByText("Add template detail selection runtime")).length
    ).toBeGreaterThan(0);
    const prLink = document.querySelector('a[href="https://github.com/acme/radarboard/pull/41"]');
    expect(prLink).toBeTruthy();

    const issueTabs = screen.getAllByRole("tab", { name: /Issues/i });
    expect(issueTabs.length).toBeGreaterThan(0);
    const issueTab = issueTabs[issueTabs.length - 1];
    if (!issueTab) throw new Error("Missing Issues tab");
    await user.click(issueTab);

    expect(
      (await screen.findAllByText("OAuth callback breaks on missing provider")).length
    ).toBeGreaterThan(0);
    const issueLink = document.querySelector(
      'a[href="https://github.com/acme/dashboard/issues/77"]'
    );
    expect(issueLink).toBeTruthy();
  });

  it("renders expanded rows with repo names and label chips", async () => {
    const user = userEvent.setup();
    render(
      createElement(GitHubActivityModuleExpanded, { projectSlug: "goshuin-atlas", config: {} })
    );

    expect(await screen.findByText("acme/radarboard")).toBeTruthy();
    expect(screen.getAllByText("widgets").length).toBeGreaterThan(0);

    const issueTabs = screen.getAllByRole("tab", { name: /Issues/i });
    expect(issueTabs.length).toBeGreaterThan(0);
    const issueTab = issueTabs[issueTabs.length - 1];
    if (!issueTab) throw new Error("Missing Issues tab");
    await user.click(issueTab);

    expect(
      (await screen.findAllByText("OAuth callback breaks on missing provider")).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("bug").length).toBeGreaterThan(0);
  });
});
