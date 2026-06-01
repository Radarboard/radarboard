export interface LinearConfig {
  apiKey: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  teamId?: string;
  priority?: number;
  labelIds?: string[];
}

export async function executeCreateLinearIssue(_config: LinearConfig, _input: CreateIssueInput) {
  return { error: "Linear issue creation requires the Linear integration." };
}

export async function executeListLinearTeams(_config: LinearConfig) {
  return [];
}

export async function executeListLinearLabels(_config: LinearConfig) {
  return [];
}
