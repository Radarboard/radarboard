import type { GitHubOpenIssueItem, GitHubOpenPRItem } from "@radarboard/types/github-activity";

// --- GitHub Stars ---
export interface MockGitHubStarsData {
  repos: {
    stars: number;
    forks: number;
    openIssues: number;
    watchers: number;
    fullName: string;
    description: string | null;
    language: string | null;
    htmlUrl: string;
    updatedAt: string;
    starsDelta?: number;
  }[];
  totalStars: number;
  totalForks: number;
}

export const MOCK_GITHUB_STARS: MockGitHubStarsData = {
  repos: [
    {
      stars: 12450,
      forks: 1280,
      openIssues: 32,
      watchers: 12450,
      fullName: "acme/pixel-studio",
      description: "A powerful online image editor built with Next.js",
      language: "TypeScript",
      htmlUrl: "https://github.com/acme/pixel-studio",
      updatedAt: "2026-03-23T14:30:00Z",
      starsDelta: 12,
    },
    {
      stars: 5890,
      forks: 423,
      openIssues: 15,
      watchers: 5890,
      fullName: "acme/brew-finder",
      description: "Discover craft breweries and local taprooms near you",
      language: "TypeScript",
      htmlUrl: "https://github.com/acme/brew-finder",
      updatedAt: "2026-03-22T10:15:00Z",
      starsDelta: 5,
    },
    {
      stars: 3210,
      forks: 287,
      openIssues: 8,
      watchers: 3210,
      fullName: "acme/task-flow",
      description: "A modern project management tool with docs-first workflow",
      language: "TypeScript",
      htmlUrl: "https://github.com/acme/task-flow",
      updatedAt: "2026-03-21T08:45:00Z",
      starsDelta: 3,
    },
    {
      stars: 1870,
      forks: 142,
      openIssues: 6,
      watchers: 1870,
      fullName: "acme/recipe-box",
      description: "Share and discover recipes with ingredient substitution suggestions",
      language: "TypeScript",
      htmlUrl: "https://github.com/acme/recipe-box",
      updatedAt: "2026-03-20T16:20:00Z",
      starsDelta: 1,
    },
    {
      stars: 945,
      forks: 89,
      openIssues: 4,
      watchers: 945,
      fullName: "acme/color-palette",
      description: "AI-powered color palette generator for designers",
      language: "TypeScript",
      htmlUrl: "https://github.com/acme/color-palette",
      updatedAt: "2026-03-19T12:00:00Z",
      starsDelta: 7,
    },
    {
      stars: 620,
      forks: 51,
      openIssues: 3,
      watchers: 620,
      fullName: "acme/font-preview",
      description: "Preview and compare fonts in real-time with your own text",
      language: "TypeScript",
      htmlUrl: "https://github.com/acme/font-preview",
      updatedAt: "2026-03-18T09:30:00Z",
      starsDelta: 0,
    },
    {
      stars: 410,
      forks: 34,
      openIssues: 2,
      watchers: 410,
      fullName: "acme/deploy-bot",
      description: "Zero-config deployment bot for GitHub Actions",
      language: "Go",
      htmlUrl: "https://github.com/acme/deploy-bot",
      updatedAt: "2026-03-17T14:45:00Z",
      starsDelta: 2,
    },
  ],
  totalStars: 25395,
  totalForks: 2306,
};

// --- GitHub Pull Requests ---
export const MOCK_GITHUB_PULLS: GitHubOpenPRItem[] = [
  {
    id: 1001,
    number: 342,
    title: "feat(search): add fuzzy matching to recipe lookup",
    htmlUrl: "https://github.com/acme/recipe-box/pull/342",
    user: { login: "contributor1", avatarUrl: "https://github.com/ghost.png" },
    labels: [{ name: "enhancement", color: "7057ff" }],
    repo: "acme/recipe-box",
    createdAt: "2026-03-23T08:30:00Z",
    updatedAt: "2026-03-23T14:00:00Z",
  },
  {
    id: 1002,
    number: 89,
    title: "fix: resolve cache invalidation on deploy",
    htmlUrl: "https://github.com/acme/brew-finder/pull/89",
    user: { login: "dependabot", avatarUrl: "https://github.com/ghost.png" },
    labels: [{ name: "bug", color: "d73a4a" }],
    repo: "acme/brew-finder",
    createdAt: "2026-03-22T16:20:00Z",
    updatedAt: "2026-03-23T09:10:00Z",
  },
  {
    id: 1003,
    number: 156,
    title: "feat: add batch export for canvas layers",
    htmlUrl: "https://github.com/acme/pixel-studio/pull/156",
    user: { login: "designdev", avatarUrl: "https://github.com/ghost.png" },
    labels: [{ name: "feature", color: "0075ca" }],
    repo: "acme/pixel-studio",
    createdAt: "2026-03-21T11:45:00Z",
    updatedAt: "2026-03-22T18:30:00Z",
  },
  {
    id: 1004,
    number: 73,
    title: "refactor: migrate task store to Zustand",
    htmlUrl: "https://github.com/acme/task-flow/pull/73",
    user: { login: "alexm", avatarUrl: "https://github.com/ghost.png" },
    labels: [{ name: "refactor", color: "e4e669" }],
    repo: "acme/task-flow",
    createdAt: "2026-03-20T09:00:00Z",
    updatedAt: "2026-03-22T16:15:00Z",
  },
  {
    id: 1005,
    number: 28,
    title: "feat: dark mode support for color palette preview",
    htmlUrl: "https://github.com/acme/color-palette/pull/28",
    user: { login: "sara-ui", avatarUrl: "https://github.com/ghost.png" },
    labels: [{ name: "enhancement", color: "a2eeef" }],
    repo: "acme/color-palette",
    createdAt: "2026-03-19T14:20:00Z",
    updatedAt: "2026-03-21T10:45:00Z",
  },
  {
    id: 1006,
    number: 157,
    title: "fix: undo/redo stack overflow on large canvases",
    htmlUrl: "https://github.com/acme/pixel-studio/pull/157",
    user: { login: "bugfix-bot", avatarUrl: "https://github.com/ghost.png" },
    labels: [{ name: "bug", color: "d73a4a" }],
    repo: "acme/pixel-studio",
    createdAt: "2026-03-22T07:15:00Z",
    updatedAt: "2026-03-23T11:00:00Z",
  },
];

// --- GitHub Issues ---
export const MOCK_GITHUB_ISSUES: GitHubOpenIssueItem[] = [
  {
    id: 2001,
    number: 45,
    title: "Support for custom layer blending modes",
    htmlUrl: "https://github.com/acme/pixel-studio/issues/45",
    user: { login: "user123", avatarUrl: "https://github.com/ghost.png" },
    labels: [{ name: "enhancement", color: "a2eeef" }],
    repo: "acme/pixel-studio",
    createdAt: "2026-03-20T10:00:00Z",
    updatedAt: "2026-03-22T15:30:00Z",
  },
  {
    id: 2002,
    number: 34,
    title: "Brewery search returns no results for some zip codes",
    htmlUrl: "https://github.com/acme/brew-finder/issues/34",
    user: { login: "beeruser42", avatarUrl: "https://github.com/ghost.png" },
    labels: [{ name: "bug", color: "d73a4a" }],
    repo: "acme/brew-finder",
    createdAt: "2026-03-19T08:00:00Z",
    updatedAt: "2026-03-21T14:20:00Z",
  },
  {
    id: 2003,
    number: 67,
    title: "Add keyboard shortcuts for common actions",
    htmlUrl: "https://github.com/acme/task-flow/issues/67",
    user: { login: "poweruser", avatarUrl: "https://github.com/ghost.png" },
    labels: [{ name: "enhancement", color: "a2eeef" }],
    repo: "acme/task-flow",
    createdAt: "2026-03-18T12:30:00Z",
    updatedAt: "2026-03-20T09:00:00Z",
  },
  {
    id: 2004,
    number: 158,
    title: "SVG export produces incorrect gradient colors",
    htmlUrl: "https://github.com/acme/pixel-studio/issues/158",
    user: { login: "vec-design", avatarUrl: "https://github.com/ghost.png" },
    labels: [{ name: "bug", color: "d73a4a" }],
    repo: "acme/pixel-studio",
    createdAt: "2026-03-22T16:45:00Z",
    updatedAt: "2026-03-23T08:15:00Z",
  },
];

// --- GitHub Commits ---
export interface MockCommitsData {
  repos: {
    repo: string;
    totalCommits: number;
    dailyStats: { date: string; count: number }[];
  }[];
}

export const MOCK_GITHUB_COMMITS: MockCommitsData = {
  repos: [
    {
      repo: "acme/pixel-studio",
      totalCommits: 802,
      dailyStats: Array.from({ length: 14 }, (_, i) => ({
        date: `2026-03-${String(i + 10).padStart(2, "0")}`,
        count: Math.floor(Math.random() * 6) + 1,
      })),
    },
    {
      repo: "acme/brew-finder",
      totalCommits: 1245,
      dailyStats: Array.from({ length: 14 }, (_, i) => ({
        date: `2026-03-${String(i + 10).padStart(2, "0")}`,
        count: Math.floor(Math.random() * 4) + 1,
      })),
    },
    {
      repo: "acme/task-flow",
      totalCommits: 456,
      dailyStats: Array.from({ length: 14 }, (_, i) => ({
        date: `2026-03-${String(i + 10).padStart(2, "0")}`,
        count: Math.floor(Math.random() * 3),
      })),
    },
  ],
};
