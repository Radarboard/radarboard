/**
 * Linear — Data types
 *
 * Config and API response types for the Linear GraphQL API.
 */

export interface LinearConfig {
  apiKey: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number; // 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
  state: {
    id: string;
    name: string;
    type: string; // "backlog" | "unstarted" | "started" | "completed" | "cancelled"
  };
  labels: {
    nodes: { id: string; name: string; color: string }[];
  };
  project: {
    id: string;
    name: string;
  } | null;
  team: {
    id: string;
    name: string;
    key: string;
  };
  url: string;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearProject {
  id: string;
  name: string;
  description: string | null;
  state: string;
  progress: number;
  targetDate: string | null;
  startDate: string | null;
  health: string | null;
  teams: { nodes: { name: string }[] };
  issues: {
    nodes: { state: { type: string } }[];
  };
}

export interface LinearLabel {
  id: string;
  name: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  teamId?: string;
  priority?: number;
  labelIds?: string[];
}

export interface CreateIssueResult {
  success: boolean;
  issue: {
    id: string;
    identifier: string;
    title: string;
    url: string;
    team: { key: string; name: string };
    state: { name: string; type: string };
  };
}

export interface LinearStartedIssue {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  state: {
    id: string;
    name: string;
    type: string;
  };
  assignee: {
    name: string;
    avatarUrl: string | null;
  } | null;
  labels: {
    nodes: { id: string; name: string; color: string }[];
  };
  project: {
    id: string;
    name: string;
  } | null;
  team: {
    id: string;
    name: string;
    key: string;
  };
  url: string;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
