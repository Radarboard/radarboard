/** Shared types for the GitHub Activity widget (open PRs + open issues). */

export interface GitHubOpenPRItem {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  user: { login: string; avatarUrl: string };
  labels: { name: string; color: string }[];
  repo: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubOpenIssueItem {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  user: { login: string; avatarUrl: string };
  labels: { name: string; color: string }[];
  repo: string;
  createdAt: string;
  updatedAt: string;
}
