export interface RoadmapProject {
  id: string;
  name: string;
  state: "planned" | "started" | "paused";
  progress: number;
  targetDate: string | null;
  health: "onTrack" | "atRisk" | "offTrack" | null;
  issueCountDone: number;
  issueCountInProgress: number;
  issueCountOpen: number;
  teams: string[];
}

export interface RoadmapInProgressIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: "critical" | "high" | "medium" | "low";
  assignee: { name: string; avatarUrl: string | null } | null;
  projectName: string | null;
  projectColor: string;
  startedAt: string;
  timeInStarted: string;
  labels: { name: string; color: string }[];
}
