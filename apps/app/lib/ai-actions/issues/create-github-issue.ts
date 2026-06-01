export interface GitHubConfig {
  token: string;
}

export interface CreateIssueInput {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}

export async function executeCreateGithubIssue(_config: GitHubConfig, _input: CreateIssueInput) {
  return { error: "GitHub issue creation requires the GitHub integration." };
}
