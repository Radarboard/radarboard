import { integrationRoute } from "@radarboard/integration-sdk/routes";
import { getEffectiveCacheTtlSeconds } from "@radarboard/types/polling";
import type { Project } from "@radarboard/types/project";

import { buildBackupTasks } from "../backup-tasks";

/** Helper to create a minimal project with specific integrations. */
function makeProject(slug: string, overrides: Partial<Project> = {}): Project {
  return {
    id: slug,
    name: slug,
    slug,
    color: "#000",
    platforms: [],
    ...overrides,
  };
}

describe("buildBackupTasks", () => {
  it("always includes a global raindrop warmup task", () => {
    const tasks = buildBackupTasks([]);
    const raindropTasks = tasks.filter((t) => t.route === integrationRoute("raindrop", "data"));

    expect(raindropTasks).toHaveLength(1);
    expect(raindropTasks[0].key).toBe("raindrop:all:30d:UTC");
    expect(raindropTasks[0].ttlSeconds).toBe(getEffectiveCacheTtlSeconds("raindrop"));
  });

  it("creates revenue tasks for projects with RevenueCat", () => {
    const project = makeProject("my-app", {
      platforms: [
        {
          id: "ios",
          name: "iOS",
          type: "ios",
          integrations: { revenuecat: { projectId: "rc-1" } },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const revenueTasks = tasks.filter((t) => t.route === integrationRoute("revenuecat", "data"));

    expect(revenueTasks).toHaveLength(2);
    expect(revenueTasks.map((t) => t.key)).toEqual([
      "revenue:my-app:30d:USD:UTC",
      "revenue:my-app:30d:CAD:UTC",
    ]);
  });

  it("creates analytics tasks for projects with OpenPanel", () => {
    const project = makeProject("my-app", {
      platforms: [
        {
          id: "web",
          name: "Web",
          type: "web_app",
          integrations: { openPanel: { projectId: "op-1" } },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const analyticsTasks = tasks.filter((t) => t.route === integrationRoute("openpanel", "data"));

    expect(analyticsTasks).toHaveLength(1);
    expect(analyticsTasks[0].key).toBe("analytics:my-app:30d:UTC");
    expect(analyticsTasks[0].ttlSeconds).toBe(getEffectiveCacheTtlSeconds("analytics"));
  });

  it("creates sentry tasks for projects with Sentry", () => {
    const project = makeProject("my-app", {
      platforms: [
        {
          id: "ios",
          name: "iOS",
          type: "ios",
          integrations: { sentry: { projectSlug: "sentry-proj" } },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const sentryTasks = tasks.filter((t) => t.route === integrationRoute("sentry", "data"));

    expect(sentryTasks).toHaveLength(1);
    expect(sentryTasks[0].key).toBe("sentry:my-app:30d:UTC");
  });

  it("creates SEO tasks per platform with GSC", () => {
    const project = makeProject("my-app", {
      platforms: [
        {
          id: "web",
          name: "Web",
          type: "web_app",
          integrations: { googleSearchConsole: { siteUrl: "https://example.com" } },
        },
        {
          id: "web2",
          name: "Web 2",
          type: "website",
          integrations: { googleSearchConsole: { siteUrl: "https://blog.example.com" } },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const seoTasks = tasks.filter(
      (t) => t.route === integrationRoute("google-search-console", "data")
    );

    expect(seoTasks).toHaveLength(2);
    expect(seoTasks.map((t) => t.key)).toEqual([
      "seo:my-app:https://example.com:30d:UTC",
      "seo:my-app:https://blog.example.com:30d:UTC",
    ]);
  });

  it("creates app-store tasks for projects with App Store Connect", () => {
    const project = makeProject("my-app", {
      platforms: [
        {
          id: "ios",
          name: "iOS",
          type: "ios",
          integrations: { appStoreConnect: { appId: "123" } },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const asTasks = tasks.filter((t) => t.route === integrationRoute("app-store-connect", "data"));

    expect(asTasks).toHaveLength(1);
    expect(asTasks[0].key).toBe("app-store:my-app:30d:UTC");
    expect(asTasks[0].ttlSeconds).toBe(getEffectiveCacheTtlSeconds("app-store"));
  });

  it("creates roadmap tasks for projects with Linear", () => {
    const project = makeProject("my-app", {
      platforms: [
        {
          id: "web",
          name: "Web",
          type: "web_app",
          integrations: { linear: { teamId: "team-1" } },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const roadmapTasks = tasks.filter((t) => t.route === integrationRoute("linear", "roadmap"));

    expect(roadmapTasks).toHaveLength(1);
    expect(roadmapTasks[0].key).toBe("roadmap:my-app");
  });

  it("creates shipping tasks for projects with GitHub/Linear/Vercel", () => {
    const project = makeProject("my-app", {
      platforms: [
        {
          id: "web",
          name: "Web",
          type: "web_app",
          integrations: {
            github: { owner: "org", repo: "repo" },
            linear: { teamId: "team-1" },
            vercel: { projectId: "vercel-1" },
          },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const shippingTasks = tasks.filter((t) => t.route === integrationRoute("shipping", "data"));

    expect(shippingTasks).toHaveLength(1);
    expect(shippingTasks[0].key).toBe("shipping:my-app:30d:UTC");
  });

  it("creates github star history tasks for projects with GitHub", () => {
    const project = makeProject("my-app", {
      platforms: [
        {
          id: "web",
          name: "Web",
          type: "web_app",
          integrations: { github: { owner: "org", repo: "repo" } },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const historyTasks = tasks.filter(
      (task) => task.route === integrationRoute("github", "stars-history")
    );

    expect(historyTasks).toHaveLength(1);
    expect(historyTasks[0].key).toBe("github-stars-history:my-app:all:none");
    expect(historyTasks[0].ttlSeconds).toBe(getEffectiveCacheTtlSeconds("github-stars"));
  });

  it("creates OC tasks per platform with Open Collective", () => {
    const project = makeProject("my-app", {
      platforms: [
        {
          id: "web",
          name: "Web",
          type: "web_app",
          integrations: { openCollective: { slug: "oc-proj-1" } },
        },
        {
          id: "web2",
          name: "Web 2",
          type: "website",
          integrations: { openCollective: { slug: "oc-proj-2" } },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const ocTasks = tasks.filter((t) => t.route === integrationRoute("open-collective", "data"));

    expect(ocTasks).toHaveLength(2);
    expect(ocTasks.map((t) => t.key)).toEqual([
      "open-collective:oc-proj-1:30d:UTC",
      "open-collective:oc-proj-2:30d:UTC",
    ]);
  });

  it("always includes health task", () => {
    const tasks = buildBackupTasks([]);
    const healthTasks = tasks.filter((t) => t.route === integrationRoute("betterstack", "data"));

    expect(healthTasks).toHaveLength(1);
    expect(healthTasks[0].key).toBe("health");
    expect(healthTasks[0].ttlSeconds).toBe(getEffectiveCacheTtlSeconds("health"));
  });

  it("skips routes for projects without relevant integrations", () => {
    const project = makeProject("basic", {
      platforms: [
        {
          id: "web",
          name: "Web",
          type: "web_app",
          integrations: { healthCheck: { url: "https://example.com" } },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);

    // Only global warmup tasks should exist — no revenue, analytics, sentry, seo, etc.
    const routes = tasks.map((t) => t.route);
    expect(routes).toEqual([
      integrationRoute("raindrop", "data"),
      integrationRoute("betterstack", "data"),
    ]);
  });

  it("assigns rateLimitGroup for RevenueCat tasks", () => {
    const project = makeProject("my-app", {
      platforms: [
        {
          id: "ios",
          name: "iOS",
          type: "ios",
          integrations: { revenuecat: { projectId: "rc-1" } },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const revenueTasks = tasks.filter((t) => t.route === integrationRoute("revenuecat", "data"));

    for (const task of revenueTasks) {
      expect(task.rateLimitGroup).toBe("revenuecat");
    }
  });

  it("assigns rateLimitGroup for App Store tasks", () => {
    const project = makeProject("my-app", {
      platforms: [
        {
          id: "ios",
          name: "iOS",
          type: "ios",
          integrations: { appStoreConnect: { appId: "123" } },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const asTasks = tasks.filter((t) => t.route === integrationRoute("app-store-connect", "data"));

    for (const task of asTasks) {
      expect(task.rateLimitGroup).toBe("appstore");
    }
  });

  it("task keys match expected patterns", () => {
    const project = makeProject("slug-1", {
      platforms: [
        {
          id: "ios",
          name: "iOS",
          type: "ios",
          integrations: {
            revenuecat: { projectId: "rc-1" },
            appStoreConnect: { appId: "123" },
            sentry: { projectSlug: "sentry-proj" },
          },
        },
        {
          id: "web",
          name: "Web",
          type: "web_app",
          integrations: {
            openPanel: { projectId: "op-1" },
            googleSearchConsole: { siteUrl: "https://example.com" },
            linear: { teamId: "team-1" },
            github: { owner: "org", repo: "repo" },
            openCollective: { slug: "oc-1" },
          },
        },
      ],
    });

    const tasks = buildBackupTasks([project]);
    const keys = tasks.map((t) => t.key);

    expect(keys).toContain("revenue:slug-1:30d:USD:UTC");
    expect(keys).toContain("revenue:slug-1:30d:CAD:UTC");
    expect(keys).toContain("analytics:slug-1:30d:UTC");
    expect(keys).toContain("raindrop:all:30d:UTC");
    expect(keys).toContain("sentry:slug-1:30d:UTC");
    expect(keys).toContain("seo:slug-1:https://example.com:30d:UTC");
    expect(keys).toContain("app-store:slug-1:30d:UTC");
    expect(keys).toContain("roadmap:slug-1");
    expect(keys).toContain("shipping:slug-1:30d:UTC");
    expect(keys).toContain("open-collective:oc-1:30d:UTC");
    expect(keys).toContain("github-stars-history:slug-1:all:none");
    expect(keys).toContain("health");
  });
});
