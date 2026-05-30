/**
 * GitHub — Data types
 *
 * Config and API response types for the GitHub REST API v3.
 */

export interface GitHubConfig {
  token: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: {
    name: string;
    color: string;
  }[];
  base: {
    repo: {
      full_name: string;
    };
  };
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  author: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: {
    name: string;
    color: string;
  }[];
  created_at: string;
  updated_at: string;
  /** Present only on issues that are actually pull requests. Used to filter them out. */
  pull_request?: unknown;
}

export interface GitHubRepository {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  full_name: string;
  description: string | null;
  language: string | null;
  html_url: string;
  updated_at: string;
  private: boolean;
}

export interface GitHubStargazer {
  starred_at: string;
  user: {
    login: string;
  };
}

export interface CreateIssueInput {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}

export interface CreateIssueResult {
  number: number;
  html_url: string;
  title: string;
}
