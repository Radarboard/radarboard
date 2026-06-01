import type { DataSourceContext } from "@radarboard/integration-sdk/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linearRoadmapDataSource } from "../linear-roadmap-data-sources";

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

function makeContext(overrides: Partial<DataSourceContext> = {}): DataSourceContext {
  return {
    resolveCredential: async () => ({ apiKey: "lin_api_test" }),
    getProjectIntegrations: async () => ({}),
    getAllProjects: async () => [],
    ...overrides,
  };
}

const params = {
  projectSlug: null,
  range: "30d" as const,
  timeZone: "UTC",
  forceRefresh: false,
  limit: 50,
};

describe("linearRoadmapDataSource", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T18:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns disconnected state only when Linear credentials are missing", async () => {
    await expect(
      linearRoadmapDataSource.fetch(params, makeContext({ resolveCredential: async () => null }))
    ).resolves.toEqual({ configured: false, projects: [], inProgressIssues: [] });
  });

  it("maps Linear projects and started issues for the Roadmap widget", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          projects: {
            nodes: [
              {
                id: "project-1",
                name: "Launch",
                progress: 0.4,
                targetDate: "2026-06-20",
                teams: { nodes: [{ id: "team-1", name: "Product", key: "PROD" }] },
              },
            ],
          },
          issues: {
            nodes: [
              {
                id: "issue-1",
                identifier: "RAD-1",
                title: "Build roadmap source",
                url: "https://linear.app/radarboard/issue/RAD-1",
                priority: 2,
                updatedAt: "2026-06-01T16:00:00.000Z",
                state: { type: "started" },
                assignee: { name: "Ada", avatarUrl: null },
                project: { id: "project-1", name: "Launch", color: "#00ff00" },
                labels: { nodes: [{ name: "release", color: "#0000ff" }] },
                team: { id: "team-1", name: "Product", key: "PROD" },
              },
            ],
          },
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(linearRoadmapDataSource.fetch(params, makeContext())).resolves.toMatchObject({
      configured: true,
      projects: [
        {
          id: "project-1",
          name: "Launch",
          state: "started",
          progress: 0.4,
          targetDate: "2026-06-20",
          issueCountInProgress: 1,
          teams: ["Product"],
        },
      ],
      inProgressIssues: [
        {
          id: "issue-1",
          identifier: "RAD-1",
          title: "Build roadmap source",
          priority: "high",
          projectName: "Launch",
          timeInStarted: "2h ago",
        },
      ],
    });
  });
});
