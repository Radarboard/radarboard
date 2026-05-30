import "@/lib/integrations-init";
import { githubDescriptor } from "@radarboard/integration-github";
import { getIntegration, registerIntegration } from "@radarboard/integration-sdk/registry";
import type { StatusSource } from "@radarboard/types/status-page";
import { describe, expect, it, vi } from "vitest";
import type { ProjectIntegrationsMap } from "@/hooks/projects/use-project-integrations";
import { deriveLinkedStatusSources } from "../status-page-links";

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
            github: {},
          },
        },
      ],
    },
    {
      id: "llmstxt-hub",
      slug: "llmstxt-hub",
      name: "LLMs.txt Hub",
      color: "#000",
      description: "",
      platforms: [
        {
          id: "llmstxt-hub-web",
          name: "LLMs.txt Hub Web",
          type: "website",
          integrations: {
            github: {},
          },
        },
      ],
    },
    {
      id: "front-end-checklist",
      slug: "front-end-checklist",
      name: "Front-end Checklist",
      color: "#000",
      description: "",
      platforms: [
        {
          id: "front-end-checklist-oc",
          name: "Front-end Checklist OC",
          type: "website",
          integrations: {
            openCollective: {},
          },
        },
      ],
    },
  ],
}));

if (!getIntegration("github")) {
  registerIntegration(githubDescriptor);
}

describe("status-page-links", () => {
  it("derives linked sources from integration-level defaults and cached state", () => {
    const projectIntegrations: ProjectIntegrationsMap = {
      "goshuin-atlas": {
        "goshuin-com": {
          github: {
            owner: "openai",
            repo: "openai-node",
          },
        },
        "@@platforms": {
          ids: ["custom-platform"],
        },
        "@@plat_custom-platform": {
          name: "Custom Platform",
          type: "website",
        },
        "custom-platform": {
          vercel: {
            projectId: "prj_123",
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

    const linkedSources = deriveLinkedStatusSources(
      projectIntegrations,
      {
        vercel: "https://www.vercel-status.com",
      },
      [cachedSource]
    );

    expect(linkedSources).toHaveLength(2);
    expect(linkedSources[0]).toMatchObject({
      id: "integration:github",
      kind: "integration",
      name: "GitHub",
      status: "degraded",
      linkedTargetCount: 2,
      integrationKey: "github",
    });
    expect(linkedSources[0]?.linkedTargetSummary).toContain("Goshuin Atlas");
    expect(linkedSources[0]?.linkedTargetSummary).toContain("LLMs.txt Hub");
    expect(linkedSources[1]).toMatchObject({
      id: "integration:vercel",
      kind: "integration",
      name: "Vercel",
      statusPageUrl: "https://www.vercel-status.com",
      linkedTargetCount: 1,
      linkedTargetSummary: "Goshuin Atlas · Custom Platform",
      integrationKey: "vercel",
    });
  });

  it("derives linked sources for user-created projects", () => {
    const projectIntegrations: ProjectIntegrationsMap = {
      "@@projects": {
        _: {
          ids: ["custom-project"],
        },
      },
      "@@proj_custom-project": {
        _: {
          name: "Custom Project",
        },
      },
      "custom-project": {
        "@@platforms": {
          ids: ["custom-platform"],
        },
        "@@plat_custom-platform": {
          name: "Custom Platform",
          type: "website",
        },
        "custom-platform": {
          sentry: {
            projectSlug: "custom-project",
          },
        },
      },
    };

    const linkedSources = deriveLinkedStatusSources(projectIntegrations, {
      sentry: "https://status.sentry.io",
    });

    expect(linkedSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "integration:sentry",
          linkedTargetCount: 1,
          linkedTargetSummary: "Custom Project · Custom Platform",
          integrationKey: "sentry",
        }),
      ])
    );
  });

  it("falls back to the integration-level default when there is no project override", () => {
    const projectIntegrations: ProjectIntegrationsMap = {
      "front-end-checklist": {
        "front-end-checklist-oc": {},
      },
    };

    const linkedSources = deriveLinkedStatusSources(projectIntegrations, {
      openCollective: "https://status.example.com",
    });

    expect(linkedSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "integration:openCollective",
          statusPageUrl: "https://status.example.com",
          integrationKey: "openCollective",
        }),
      ])
    );
  });

  it("falls back to the integration descriptor default when there is no saved override", () => {
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

    const linkedSources = deriveLinkedStatusSources(projectIntegrations);

    expect(linkedSources[0]).toMatchObject({
      id: "integration:github",
      statusPageUrl: "https://www.githubstatus.com",
      integrationKey: "github",
    });
  });

  it("prefers the project override over the integration-level default", () => {
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

    const linkedSources = deriveLinkedStatusSources(projectIntegrations, {
      github: "https://project-specific.example.com",
    });

    expect(linkedSources[0]?.statusPageUrl).toBe("https://project-specific.example.com");
  });

  it("collapses multiple linked platforms of the same integration into one source", () => {
    const projectIntegrations: ProjectIntegrationsMap = {
      "goshuin-atlas": {
        "goshuin-com": {
          github: {
            owner: "openai",
            repo: "openai-node",
          },
        },
      },
      "llmstxt-hub": {
        "llmstxt-hub-web": {
          github: {
            owner: "openai",
            repo: "openai-node",
          },
        },
      },
    };

    const linkedSources = deriveLinkedStatusSources(projectIntegrations, {
      github: "https://www.githubstatus.com",
    });

    expect(linkedSources).toHaveLength(1);
    expect(linkedSources[0]).toMatchObject({
      id: "integration:github",
      linkedTargetCount: 2,
    });
    expect(linkedSources[0]?.linkedTargetSummary).toContain("Goshuin Atlas");
    expect(linkedSources[0]?.linkedTargetSummary).toContain("LLMs.txt Hub");
  });
});
