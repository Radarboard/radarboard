export type HealthStatus = "up" | "down" | "degraded";

export interface HealthCheck {
  id: string;
  name: string;
  url: string;
  status: HealthStatus;
  responseTimeMs: number;
  lastCheckedAt: string;
  projectName?: string;
}

export interface HealthIncident {
  id: string;
  name: string;
  url: string;
  cause: string;
  startedAt: string;
}
