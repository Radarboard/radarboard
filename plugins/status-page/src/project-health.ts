import type { Project } from "@radarboard/types/project";

export interface HealthCheckConfig {
  url: string;
  expectedStatus: number;
}

export interface ProjectHealthResult {
  ok: boolean;
  responseStatus?: number;
  checkedAt: string;
  responseTimeMs: number;
  error?: string;
}

export function findHealthCheck(
  projects: Project[],
  projectSlug: string,
  platformId: string
): HealthCheckConfig | null {
  const project = projects.find((entry) => entry.slug === projectSlug);
  const platform = project?.platforms.find((entry) => entry.id === platformId);
  const healthCheck =
    platform?.integrations.healthCheck &&
    typeof platform.integrations.healthCheck === "object" &&
    platform.integrations.healthCheck !== null
      ? (platform.integrations.healthCheck as {
          url?: unknown;
          expectedStatus?: unknown;
        })
      : null;

  if (!project || !platform || typeof healthCheck?.url !== "string" || !healthCheck.url) {
    return null;
  }

  return {
    url: healthCheck.url,
    expectedStatus:
      typeof healthCheck.expectedStatus === "number" ? healthCheck.expectedStatus : 200,
  };
}

export async function checkProjectHealth(
  projects: Project[],
  projectSlug: string,
  platformId: string
): Promise<ProjectHealthResult | null> {
  const healthCheck = findHealthCheck(projects, projectSlug, platformId);
  if (!healthCheck) return null;

  const startedAt = Date.now();

  try {
    const response = await fetch(healthCheck.url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });

    return {
      ok: response.status === healthCheck.expectedStatus,
      responseStatus: response.status,
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
    };
  }
}
