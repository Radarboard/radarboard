import { describe, expect, it, vi } from "vitest";
import {
  buildStatusPageTransitionNotifications,
  getStatusFromStatusPageSummary,
  hasStatusPageStatusChanges,
  mergeStatusPageSources,
  normalizeStatusPageSummaryUrl,
  refreshStatusSources,
  replaceStandaloneEntriesInCache,
  resolveStatusPageRefreshIntervalMs,
} from "./statuspage";
import type { StatusSource } from "./types";

describe("statuspage helpers", () => {
  describe("normalizeStatusPageSummaryUrl", () => {
    it("normalizes a public status page root", () => {
      expect(normalizeStatusPageSummaryUrl("https://status.cursor.com")).toBe(
        "https://status.cursor.com/api/v2/summary.json"
      );
    });

    it("normalizes history and incident URLs back to the summary endpoint", () => {
      expect(normalizeStatusPageSummaryUrl("https://status.cursor.com/history.atom")).toBe(
        "https://status.cursor.com/api/v2/summary.json"
      );
      expect(normalizeStatusPageSummaryUrl("https://status.cursor.com/incidents/abc123")).toBe(
        "https://status.cursor.com/api/v2/summary.json"
      );
    });

    it("preserves an existing api/v2 prefix", () => {
      expect(normalizeStatusPageSummaryUrl("https://status.cursor.com/api/v2/status.json")).toBe(
        "https://status.cursor.com/api/v2/summary.json"
      );
    });
  });

  describe("getStatusFromStatusPageSummary", () => {
    it("uses the worst component status when components are present", () => {
      expect(
        getStatusFromStatusPageSummary({
          status: { indicator: "none" },
          components: [{ status: "operational" }, { status: "partial_outage" }],
        })
      ).toBe("degraded");
    });

    it("falls back to the top-level indicator", () => {
      expect(
        getStatusFromStatusPageSummary({
          status: { indicator: "critical" },
          components: [],
        })
      ).toBe("outage");
    });
  });

  describe("refreshStatusSources", () => {
    const checkedAt = "2026-03-20T12:00:00.000Z";

    it("refreshes explicit status pages and standalone url fallbacks", async () => {
      const fetchMock = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            status: { indicator: "none" },
            components: [{ status: "operational" }, { status: "under_maintenance" }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      });

      const sources: StatusSource[] = [
        {
          id: "cursor",
          kind: "standalone",
          name: "Cursor",
          url: "https://cursor.com",
          statusPageUrl: "https://status.cursor.com",
          status: "unknown",
          lastCheckedAt: "2026-03-20T11:00:00.000Z",
          addedAt: "2026-03-20T10:00:00.000Z",
        },
        {
          id: "manual",
          kind: "standalone",
          name: "Manual service",
          url: "https://example.com",
          status: "operational",
          lastCheckedAt: "2026-03-20T09:00:00.000Z",
          addedAt: "2026-03-20T08:00:00.000Z",
        },
      ];

      const updated = await refreshStatusSources(sources, fetchMock, checkedAt);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledWith("https://status.cursor.com/api/v2/summary.json", {
        headers: { accept: "application/json" },
      });
      expect(fetchMock).toHaveBeenCalledWith("https://example.com/api/v2/summary.json", {
        headers: { accept: "application/json" },
      });
      expect(updated[0]?.status).toBe("degraded");
      expect(updated[0]?.lastCheckedAt).toBe(checkedAt);
      expect(updated[0]?.remoteUpdatedAt).toBeNull();
      expect(updated[1]).toMatchObject({
        id: "manual",
        kind: "standalone",
        status: "degraded",
        alertsEnabled: true,
      });
    });

    it("uses the standalone url as fallback status page url", async () => {
      const fetchMock = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            status: { indicator: "none" },
            components: [{ status: "operational" }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      });

      const sources: StatusSource[] = [
        {
          id: "cursor",
          kind: "standalone",
          name: "Cursor",
          url: "https://status.cursor.com",
          status: "unknown",
          lastCheckedAt: "2026-03-20T11:00:00.000Z",
          addedAt: "2026-03-20T10:00:00.000Z",
        },
      ];

      const updated = await refreshStatusSources(sources, fetchMock, checkedAt);

      expect(fetchMock).toHaveBeenCalledWith("https://status.cursor.com/api/v2/summary.json", {
        headers: { accept: "application/json" },
      });
      expect(updated[0]?.status).toBe("operational");
    });

    it("refreshes project health sources through the local project health route", async () => {
      const fetchMock = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            ok: true,
            checkedAt: "2026-03-20T12:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      });

      const sources: StatusSource[] = [
        {
          id: "project:goshuin-atlas:goshuin-com",
          kind: "project",
          name: "goshuin.com",
          url: "https://goshuin.com",
          statusPageUrl: "https://goshuin.com",
          status: "unknown",
          lastCheckedAt: "2026-03-20T11:00:00.000Z",
          addedAt: "2026-03-20T10:00:00.000Z",
          projectSlug: "goshuin-atlas",
          projectName: "Goshuin Atlas",
          platformId: "goshuin-com",
          platformName: "goshuin.com",
          integrationKey: "healthCheck",
        },
      ];

      const updated = await refreshStatusSources(sources, fetchMock, checkedAt);

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/status-page/project-health?projectSlug=goshuin-atlas&platformId=goshuin-com"
      );
      expect(updated[0]?.status).toBe("operational");
    });

    it("marks a status page source as unknown when the fetch fails", async () => {
      const fetchMock = vi.fn(async () => {
        return new Response("upstream failed", { status: 503 });
      });

      const sources: StatusSource[] = [
        {
          id: "claude",
          kind: "standalone",
          name: "Claude",
          url: "https://claude.ai",
          statusPageUrl: "https://status.claude.com",
          status: "operational",
          lastCheckedAt: "2026-03-20T11:00:00.000Z",
          addedAt: "2026-03-20T10:00:00.000Z",
        },
      ];

      const updated = await refreshStatusSources(sources, fetchMock, checkedAt);

      expect(updated[0]?.status).toBe("unknown");
      expect(updated[0]?.lastCheckedAt).toBe(checkedAt);
    });

    it("marks JSON health sources as outage when the fetch throws", async () => {
      const fetchMock = vi.fn(async () => {
        throw new Error("network error");
      });

      const sources: StatusSource[] = [
        {
          id: "webhook-relay",
          kind: "standalone",
          name: "Webhook Relay",
          url: "https://relay.example.com/api/health",
          status: "operational",
          lastCheckedAt: "2026-03-20T11:00:00.000Z",
          addedAt: "2026-03-20T10:00:00.000Z",
        },
      ];

      const updated = await refreshStatusSources(sources, fetchMock, checkedAt);

      expect(updated[0]?.status).toBe("outage");
      expect(updated[0]?.lastCheckedAt).toBe(checkedAt);
    });
  });

  describe("hasStatusPageStatusChanges", () => {
    it("ignores timestamp-only refreshes", () => {
      const cursorSource: StatusSource = {
        id: "cursor",
        kind: "standalone",
        name: "Cursor",
        url: "https://cursor.com",
        statusPageUrl: "https://status.cursor.com",
        status: "operational",
        lastCheckedAt: "2026-03-20T11:00:00.000Z",
        addedAt: "2026-03-20T10:00:00.000Z",
      };
      const previous: StatusSource[] = [cursorSource];

      const next: StatusSource[] = [
        {
          ...cursorSource,
          lastCheckedAt: "2026-03-20T12:00:00.000Z",
        },
      ];

      expect(hasStatusPageStatusChanges(previous, next)).toBe(false);
    });
  });

  describe("resolveStatusPageRefreshIntervalMs", () => {
    it("uses the configured refresh interval", () => {
      expect(
        resolveStatusPageRefreshIntervalMs({
          settings: { "refresh-interval": 120 },
        })
      ).toBe(120_000);
    });

    it("clamps invalid refresh interval values", () => {
      expect(
        resolveStatusPageRefreshIntervalMs({
          settings: { "refresh-interval": 1 },
        })
      ).toBe(15_000);
      expect(
        resolveStatusPageRefreshIntervalMs({
          settings: { "refresh-interval": 7200 },
        })
      ).toBe(3_600_000);
    });
  });

  describe("buildStatusPageTransitionNotifications", () => {
    it("emits outage and recovery notifications for automatic sources", () => {
      const cursorSource: StatusSource = {
        id: "cursor",
        kind: "standalone",
        name: "Cursor",
        url: "https://cursor.com",
        statusPageUrl: "https://status.cursor.com",
        status: "operational",
        lastCheckedAt: "2026-03-20T11:00:00.000Z",
        addedAt: "2026-03-20T10:00:00.000Z",
        alertsEnabled: true,
        remoteUpdatedAt: "2026-03-20T11:59:00.000Z",
      };
      const previous: StatusSource[] = [cursorSource];

      const outage: StatusSource[] = [
        {
          ...cursorSource,
          status: "outage",
          remoteUpdatedAt: "2026-03-20T12:00:00.000Z",
        },
      ];

      const recovery: StatusSource[] = [
        {
          ...cursorSource,
          status: "operational",
          remoteUpdatedAt: "2026-03-20T12:05:00.000Z",
        },
      ];

      const outageNotifications = buildStatusPageTransitionNotifications(previous, outage);
      const recoveryNotifications = buildStatusPageTransitionNotifications(outage, recovery);

      expect(outageNotifications).toHaveLength(1);
      expect(outageNotifications[0]?.source).toBe("status-page");
      expect(outageNotifications[0]?.severity).toBe("critical");
      expect(outageNotifications[0]?.type).toBe("status.outage");
      expect(outageNotifications[0]?.sourceEventId).toContain("2026-03-20T12:00:00.000Z");

      expect(recoveryNotifications).toHaveLength(1);
      expect(recoveryNotifications[0]?.severity).toBe("info");
      expect(recoveryNotifications[0]?.type).toBe("status.recovered");
    });

    it("skips muted sources and unknown transitions", () => {
      const claudeSource: StatusSource = {
        id: "claude",
        kind: "standalone",
        name: "Claude",
        url: "https://claude.ai",
        statusPageUrl: "https://status.claude.com",
        status: "unknown",
        lastCheckedAt: "2026-03-20T11:00:00.000Z",
        addedAt: "2026-03-20T10:00:00.000Z",
        alertsEnabled: false,
        remoteUpdatedAt: null,
      };
      const previous: StatusSource[] = [claudeSource];

      const next: StatusSource[] = [
        {
          ...claudeSource,
          status: "outage",
          remoteUpdatedAt: "2026-03-20T12:00:00.000Z",
        },
      ];

      expect(buildStatusPageTransitionNotifications(previous, next)).toEqual([]);
    });

    it("routes linked status pages through the integration source", () => {
      const githubSource: StatusSource = {
        id: "integration:github",
        kind: "integration",
        name: "GitHub",
        url: "https://www.githubstatus.com",
        statusPageUrl: "https://www.githubstatus.com",
        status: "operational",
        lastCheckedAt: "2026-03-20T11:00:00.000Z",
        addedAt: "2026-03-20T10:00:00.000Z",
        remoteUpdatedAt: "2026-03-20T11:59:00.000Z",
        projectSlug: null,
        projectName: null,
        platformId: null,
        platformName: null,
        integrationKey: "github",
        linkedTargetCount: 5,
        linkedTargetSummary: "Goshuin Atlas · goshuin.com · +4 more",
      };
      const previous: StatusSource[] = [githubSource];
      const next: StatusSource[] = [
        {
          ...githubSource,
          status: "outage",
          remoteUpdatedAt: "2026-03-20T12:00:00.000Z",
        },
      ];

      const notifications = buildStatusPageTransitionNotifications(previous, next);

      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        source: "github",
        type: "status.outage",
        metadata: {
          linkedStatusPage: true,
          projectSlug: null,
          platformId: null,
          integrationKey: "github",
        },
      });
    });
  });

  describe("cache helpers", () => {
    it("replaces standalone cache entries without dropping linked sources", () => {
      const cachedSources: StatusSource[] = [
        {
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
          linkedTargetCount: 5,
          linkedTargetSummary: "Goshuin Atlas · goshuin.com · +4 more",
        },
        {
          id: "manual",
          kind: "standalone",
          name: "Manual service",
          url: "https://example.com",
          statusPageUrl: "https://status.example.com",
          status: "outage",
          lastCheckedAt: "2026-03-20T12:00:00.000Z",
          addedAt: "2026-03-20T10:00:00.000Z",
          alertsEnabled: false,
          remoteUpdatedAt: null,
        },
      ];
      const standaloneSources: StatusSource[] = [
        {
          id: "manual",
          kind: "standalone",
          name: "Manual service",
          url: "https://example.com",
          statusPageUrl: "https://status.example.com",
          status: "unknown",
          lastCheckedAt: "2026-03-20T09:00:00.000Z",
          addedAt: "2026-03-20T08:00:00.000Z",
          alertsEnabled: true,
          remoteUpdatedAt: null,
        },
      ];

      const nextCache = replaceStandaloneEntriesInCache(cachedSources, standaloneSources);

      expect(nextCache).toHaveLength(2);
      expect(nextCache.find((source) => source.id.startsWith("integration:"))?.kind).toBe(
        "integration"
      );
      expect(nextCache.find((source) => source.id === "manual")?.alertsEnabled).toBe(true);
    });

    it("merges linked cached sources with standalone definitions", () => {
      const standaloneSources: StatusSource[] = [
        {
          id: "manual",
          kind: "standalone",
          name: "Manual service",
          url: "https://example.com",
          statusPageUrl: "https://status.example.com",
          status: "unknown",
          lastCheckedAt: "2026-03-20T09:00:00.000Z",
          addedAt: "2026-03-20T08:00:00.000Z",
          alertsEnabled: true,
          remoteUpdatedAt: null,
        },
      ];
      const cachedSources: StatusSource[] = [
        {
          id: "integration:github",
          kind: "integration",
          name: "GitHub",
          url: "https://www.githubstatus.com",
          statusPageUrl: "https://www.githubstatus.com",
          status: "outage",
          lastCheckedAt: "2026-03-20T12:00:00.000Z",
          addedAt: "2026-03-20T10:00:00.000Z",
          remoteUpdatedAt: "2026-03-20T12:00:00.000Z",
          projectSlug: null,
          projectName: null,
          platformId: null,
          platformName: null,
          integrationKey: "github",
          linkedTargetCount: 5,
          linkedTargetSummary: "Goshuin Atlas · goshuin.com · +4 more",
        },
        {
          id: "manual",
          kind: "standalone",
          name: "Manual service",
          url: "https://example.com",
          statusPageUrl: "https://status.example.com",
          status: "degraded",
          lastCheckedAt: "2026-03-20T12:00:00.000Z",
          addedAt: "2026-03-20T08:00:00.000Z",
          alertsEnabled: true,
          remoteUpdatedAt: null,
        },
      ];

      const mergedSources = mergeStatusPageSources(standaloneSources, cachedSources);

      expect(mergedSources).toHaveLength(2);
      expect(mergedSources.find((source) => source.id === "manual")?.status).toBe("degraded");
      expect(mergedSources.find((source) => source.id === "integration:github")?.kind).toBe(
        "integration"
      );
    });

    it("applies mute and disable preferences to all source kinds", () => {
      const mergedSources = mergeStatusPageSources(
        [
          {
            id: "manual",
            kind: "standalone",
            name: "Manual service",
            url: "https://example.com",
            statusPageUrl: "https://status.example.com",
            status: "operational",
            lastCheckedAt: "2026-03-20T09:00:00.000Z",
            addedAt: "2026-03-20T08:00:00.000Z",
            alertsEnabled: true,
            remoteUpdatedAt: null,
          },
        ],
        [
          {
            id: "integration:github",
            kind: "integration",
            name: "GitHub",
            url: "https://www.githubstatus.com",
            statusPageUrl: "https://www.githubstatus.com",
            status: "degraded",
            lastCheckedAt: "2026-03-20T12:00:00.000Z",
            addedAt: "2026-03-20T10:00:00.000Z",
            integrationKey: "github",
            linkedTargetCount: 2,
            linkedTargetSummary: "Goshuin Atlas · goshuin.com · +1 more",
          },
          {
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
          },
        ],
        {
          manual: { muted: true },
          "integration:github": { disabled: true },
          "project:goshuin-atlas:goshuin-com": { muted: true, disabled: true },
        }
      );

      expect(mergedSources.find((source) => source.id === "manual")).toMatchObject({
        muted: true,
      });
      expect(mergedSources.find((source) => source.id === "integration:github")).toMatchObject({
        disabled: true,
      });
      expect(
        mergedSources.find((source) => source.id === "project:goshuin-atlas:goshuin-com")
      ).toMatchObject({
        muted: true,
        disabled: true,
      });
    });

    it("collapses stale linked integration entries into one source", () => {
      const mergedSources = mergeStatusPageSources(
        [],
        [
          {
            id: "integration:goshuin-atlas:goshuin-com:github",
            kind: "integration",
            name: "GitHub",
            url: "https://www.githubstatus.com",
            statusPageUrl: "https://www.githubstatus.com",
            status: "operational",
            lastCheckedAt: "2026-03-20T12:00:00.000Z",
            addedAt: "2026-03-20T10:00:00.000Z",
            projectName: "Goshuin Atlas",
            platformName: "goshuin.com",
            integrationKey: "github",
          },
          {
            id: "integration:llmstxt-hub:llmstxt-hub-web:github",
            kind: "integration",
            name: "GitHub",
            url: "https://www.githubstatus.com",
            statusPageUrl: "https://www.githubstatus.com",
            status: "operational",
            lastCheckedAt: "2026-03-20T12:00:00.000Z",
            addedAt: "2026-03-20T10:00:00.000Z",
            projectName: "LLMs.txt Hub",
            platformName: "llmstxthub.com",
            integrationKey: "github",
          },
        ]
      );

      expect(mergedSources).toHaveLength(1);
      expect(mergedSources[0]).toMatchObject({
        id: "integration:github",
        linkedTargetCount: 2,
      });
      expect(mergedSources[0]?.linkedTargetSummary).toContain("Goshuin Atlas");
      expect(mergedSources[0]?.linkedTargetSummary).toContain("LLMs.txt Hub");
    });
  });
});
