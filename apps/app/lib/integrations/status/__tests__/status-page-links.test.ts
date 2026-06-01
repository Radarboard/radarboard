import type { StatusSource } from "@radarboard/types/status-page";
import { describe, expect, it } from "vitest";
import type { ProjectIntegrationsMap } from "@/hooks/projects/use-project-integrations";
import { deriveLinkedStatusSources } from "../status-page-links";

describe("status-page-links", () => {
  it("does not synthesize provider status sources when provider descriptors are not registered", () => {
    const projectIntegrations: ProjectIntegrationsMap = {
      "goshuin-atlas": {
        "goshuin-com": {
          github: {
            owner: "openai",
            repo: "openai-node",
          },
        },
      },
    };

    const cachedSource: StatusSource = {
      id: "integration:github",
      kind: "integration",
      name: "GitHub",
      url: "https://www.githubstatus.com",
      statusPageUrl: "https://www.githubstatus.com",
      status: "degraded",
      lastCheckedAt: "2026-03-20T12:00:00.000Z",
      addedAt: "2026-03-20T10:00:00.000Z",
      remoteUpdatedAt: "2026-03-20T12:00:00.000Z",
      projectSlug: null,
      projectName: null,
      platformId: null,
      platformName: null,
      integrationKey: "github",
      linkedTargetCount: 1,
      linkedTargetSummary: "Goshuin Atlas · goshuin.com",
    };

    expect(deriveLinkedStatusSources(projectIntegrations, {}, [cachedSource])).toEqual([]);
  });
});
