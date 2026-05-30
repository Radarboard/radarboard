/**
 * AI Action: Create a Linear issue.
 *
 * Delegates to the Linear integration client for all API calls.
 */

import { createIssue, getLabels, getTeams } from "@radarboard/integration-linear/client";
import type { CreateIssueInput, LinearConfig } from "@radarboard/integration-linear/types";

export type { CreateIssueInput };

export async function executeCreateLinearIssue(config: LinearConfig, input: CreateIssueInput) {
  return createIssue(config, input);
}

export async function executeListLinearTeams(config: LinearConfig) {
  return getTeams(config);
}

export async function executeListLinearLabels(config: LinearConfig) {
  return getLabels(config);
}
