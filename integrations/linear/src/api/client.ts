/**
 * Linear GraphQL API client for the Radarboard dashboard.
 *
 * Uses the GraphQL API at https://api.linear.app/graphql
 * Authenticated via personal API key (Bearer token).
 *
 * All responses are cached server-side for 2 minutes.
 *
 * @see https://developers.linear.app/docs/graphql/working-with-the-graphql-api
 */

import type {
  CreateIssueInput,
  CreateIssueResult,
  LinearConfig,
  LinearIssue,
  LinearLabel,
  LinearProject,
  LinearStartedIssue,
  LinearTeam,
} from "../types";

const GRAPHQL_URL = "https://api.linear.app/graphql";

// --- Cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// --- Error ---

export class LinearAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "LinearAPIError";
  }
}

// --- Fetcher ---

interface GQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function fetchLinear<T>(
  config: LinearConfig,
  query: string,
  variables: Record<string, unknown>,
  cacheKey: string,
  cacheTtlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new LinearAPIError(
      response.status,
      `HTTP ${response.status}: ${response.statusText}`,
      response.status >= 500 || response.status === 429
    );
  }

  const json = (await response.json()) as GQLResponse<T>;

  if (json.errors?.length) {
    const message = json.errors.map((e) => e.message).join("; ");
    throw new LinearAPIError(200, `GraphQL error: ${message}`, false);
  }

  if (!json.data) {
    throw new LinearAPIError(200, "No data returned from GraphQL", false);
  }

  setCache(cacheKey, json.data, cacheTtlMs);
  return json.data;
}

// --- GraphQL Queries ---

const PROJECTS_QUERY = `
  query ActiveProjects($filter: ProjectFilter, $first: Int!) {
    projects(filter: $filter, first: $first, orderBy: updatedAt) {
      nodes {
        id
        name
        description
        state
        progress
        targetDate
        startDate
        health
        teams {
          nodes {
            name
          }
        }
        issues {
          nodes {
            state {
              type
            }
          }
        }
      }
    }
  }
`;

const STARTED_ISSUES_QUERY = `
  query StartedIssues($filter: IssueFilter, $first: Int!) {
    issues(filter: $filter, first: $first, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        priority
        state {
          id
          name
          type
        }
        assignee {
          name
          avatarUrl
        }
        labels {
          nodes {
            id
            name
            color
          }
        }
        project {
          id
          name
        }
        team {
          id
          name
          key
        }
        url
        startedAt
        createdAt
        updatedAt
      }
    }
  }
`;

const COMPLETED_ISSUES_QUERY = `
  query CompletedIssues($filter: IssueFilter, $first: Int!) {
    issues(filter: $filter, first: $first, orderBy: completedAt) {
      nodes {
        id
        identifier
        title
        state {
          id
          name
          type
        }
        labels {
          nodes {
            id
            name
            color
          }
        }
        project {
          id
          name
        }
        team {
          id
          name
          key
        }
        url
        createdAt
        completedAt
        updatedAt
      }
    }
  }
`;

const TEAMS_QUERY = `
  query Teams {
    teams {
      nodes {
        id
        name
        key
      }
    }
  }
`;

const LABELS_QUERY = `
  query Labels {
    issueLabels(first: 100) {
      nodes {
        id
        name
      }
    }
  }
`;

const CREATE_ISSUE_MUTATION = `
  mutation CreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
        title
        url
        team { key name }
        state { name type }
      }
    }
  }
`;

// --- Public API ---

/**
 * Get active projects (not completed or cancelled) from Linear.
 *
 * In Linear, "projects" map to releases or milestones (e.g. "v1.4.0 - Social Feed").
 * Each project has a progress percentage, target date, and health indicator.
 *
 * Cache TTL: 2 minutes
 */
export async function getActiveProjects(
  config: LinearConfig,
  options?: {
    teamId?: string;
  }
): Promise<LinearProject[]> {
  const filter: Record<string, unknown> = {
    state: { nin: ["completed", "cancelled"] },
  };
  if (options?.teamId) {
    filter.accessibleTeams = { id: { eq: options.teamId } };
  }

  const cacheKey = `linear:projects:${JSON.stringify(filter)}`;
  const data = await fetchLinear<{ projects: { nodes: LinearProject[] } }>(
    config,
    PROJECTS_QUERY,
    { filter, first: 50 },
    cacheKey
  );
  return data.projects.nodes;
}

/**
 * Get issues currently in "started" state from Linear.
 *
 * These are issues someone is actively working on right now.
 *
 * Cache TTL: 2 minutes
 */
export async function getInProgressIssues(
  config: LinearConfig,
  options?: {
    teamId?: string;
    limit?: number;
  }
): Promise<LinearStartedIssue[]> {
  const limit = options?.limit ?? 30;
  const filter: Record<string, unknown> = {
    state: { type: { eq: "started" } },
  };
  if (options?.teamId) filter.team = { id: { eq: options.teamId } };

  const cacheKey = `linear:started:${JSON.stringify(filter)}:${limit}`;
  const data = await fetchLinear<{ issues: { nodes: LinearStartedIssue[] } }>(
    config,
    STARTED_ISSUES_QUERY,
    { filter, first: limit },
    cacheKey
  );
  return data.issues.nodes;
}

/**
 * Get recently completed issues for the shipping log.
 *
 * Cache TTL: 2 minutes
 */
export async function getRecentlyCompletedIssues(
  config: LinearConfig,
  options?: {
    teamId?: string;
    limit?: number;
  }
): Promise<LinearIssue[]> {
  const limit = options?.limit ?? 20;
  const filter: Record<string, unknown> = {
    state: { type: { eq: "completed" } },
  };
  if (options?.teamId) filter.team = { id: { eq: options.teamId } };

  const cacheKey = `linear:completed:${JSON.stringify(filter)}:${limit}`;
  const data = await fetchLinear<{ issues: { nodes: LinearIssue[] } }>(
    config,
    COMPLETED_ISSUES_QUERY,
    { filter, first: limit },
    cacheKey
  );
  return data.issues.nodes;
}

/**
 * Get all teams in the workspace.
 *
 * Cache TTL: 1 hour (teams rarely change)
 */
export async function getTeams(config: LinearConfig): Promise<LinearTeam[]> {
  const cacheKey = "linear:teams";
  const data = await fetchLinear<{ teams: { nodes: LinearTeam[] } }>(
    config,
    TEAMS_QUERY,
    {},
    cacheKey,
    60 * 60 * 1000
  );
  return data.teams.nodes;
}

/**
 * Get all issue labels in the workspace.
 *
 * Cache TTL: 1 hour (labels rarely change)
 */
export async function getLabels(config: LinearConfig): Promise<LinearLabel[]> {
  const cacheKey = "linear:labels";
  const data = await fetchLinear<{ issueLabels: { nodes: LinearLabel[] } }>(
    config,
    LABELS_QUERY,
    {},
    cacheKey,
    60 * 60 * 1000
  );
  return data.issueLabels.nodes;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new issue in Linear.
 *
 * If no teamId is provided, the first team in the workspace is used.
 */
export async function createIssue(
  config: LinearConfig,
  input: CreateIssueInput
): Promise<CreateIssueResult> {
  let { teamId } = input;

  if (!teamId) {
    const teams = await getTeams(config);
    const firstTeam = teams[0];
    if (!firstTeam) throw new LinearAPIError(400, "No teams found in Linear workspace", false);
    teamId = firstTeam.id;
  }

  const issueInput: Record<string, unknown> = {
    title: input.title,
    teamId,
  };
  if (input.description) issueInput.description = input.description;
  if (input.priority !== undefined) issueInput.priority = input.priority;
  if (input.labelIds?.length) issueInput.labelIds = input.labelIds;

  // Mutations are not cached
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.apiKey,
    },
    body: JSON.stringify({ query: CREATE_ISSUE_MUTATION, variables: { input: issueInput } }),
  });

  if (!response.ok) {
    throw new LinearAPIError(
      response.status,
      `HTTP ${response.status}: ${response.statusText}`,
      response.status >= 500 || response.status === 429
    );
  }

  const json = (await response.json()) as GQLResponse<{ issueCreate: CreateIssueResult }>;

  if (json.errors?.length) {
    const message = json.errors.map((e) => e.message).join("; ");
    throw new LinearAPIError(200, `GraphQL error: ${message}`, false);
  }

  if (!json.data) {
    throw new LinearAPIError(200, "No data returned from GraphQL", false);
  }

  return json.data.issueCreate;
}
