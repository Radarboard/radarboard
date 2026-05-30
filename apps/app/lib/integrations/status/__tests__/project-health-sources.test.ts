import type { StatusSource } from "@radarboard/types/status-page";
import { describe, expect, it, vi } from "vitest";
import type { ProjectIntegrationsMap } from "@/hooks/projects/use-project-integrations";
import { deriveProjectHealthSources } from "../project-health-sources";

vi.mock("@/config/projects", () => ({
  PROJECTS: [
    {
      id: "goshuin-atlas",
      slug: "goshuin-atlas",
      name: "Goshuin Atlas",
      color: "#000",
      description: "",
      platforms: [
        {
          id: "goshuin-com",
          name: "goshuin.com",
          type: "website",
          integrations: {
            healthCheck: {
              url: "https://goshuin.com",
            },
          },
        },
      ],
    },
  ],
}));

describe("project-health-sources", () => {
  it("derives health sources from configured platform health checks", () => {
    const projectIntegrations: ProjectIntegrationsMap = {};

    const sources = deriveProjectHealthSources(projectIntegrations);

    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0]).toMatchObject({
      kind: "project",
      integrationKey: "healthCheck",
    });
  });

  it("reuses cached status for project health sources", () => {
    const projectIntegrations: ProjectIntegrationsMap = {};
    const cachedSource: StatusSource = {
      id: "project:goshuin-atlas:goshuin-com",
      kind: "project",
      name: "goshuin.com",
      url: "https://goshuin.com",
      statusPageUrl: "https://goshuin.com",
      status: "outage",
      lastCheckedAt: "2026-03-20T12:00:00.000Z",
      addedAt: "2026-03-20T10:00:00.000Z",
      projectSlug: "goshuin-atlas",
      projectName: "Goshuin Atlas",
      platformId: "goshuin-com",
      platformName: "goshuin.com",
      integrationKey: "healthCheck",
    };

    const sources = deriveProjectHealthSources(projectIntegrations, [cachedSource]);

    expect(
      sources.find((source) => source.id === "project:goshuin-atlas:goshuin-com")
    ).toMatchObject({
      status: "outage",
      lastCheckedAt: "2026-03-20T12:00:00.000Z",
    });
  });
});
