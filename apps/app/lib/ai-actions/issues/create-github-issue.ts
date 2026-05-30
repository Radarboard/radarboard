/**
 * AI Action: Create a GitHub issue.
 *
 * Delegates to the GitHub integration client for all API calls.
 */

import { createIssue } from "@radarboard/integration-github/client";
import type { CreateIssueInput, GitHubConfig } from "@radarboard/integration-github/types";

export type { CreateIssueInput };

export async function executeCreateGithubIssue(config: GitHubConfig, input: CreateIssueInput) {
  return createIssue(config, input);
}
