import type { CommonRouteParams, DataSourceContext } from "@radarboard/integration-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const getActiveIncidents = vi.fn();
const getRecentIncidents = vi.fn();
const getServices = vi.fn();
const getOnCalls = vi.fn();

vi.mock("./client", () => ({
  getActiveIncidents: (...args: unknown[]) => getActiveIncidents(...args),
  getRecentIncidents: (...args: unknown[]) => getRecentIncidents(...args),
  getServices: (...args: unknown[]) => getServices(...args),
  getOnCalls: (...args: unknown[]) => getOnCalls(...args),
}));

import {
  pagerdutyIncidentsDataSource,
  pagerdutyOnCallDataSource,
  pagerdutyServicesDataSource,
} from "./data-sources";

const stubParams: Record<string, unknown> & CommonRouteParams = {
  projectSlug: null,
  range: "30d",
  timeZone: "UTC",
  forceRefresh: false,
};

function stubCtx(resolveValue: Record<string, string> | null): DataSourceContext {
  return {
    resolveCredential: vi.fn().mockResolvedValue(resolveValue),
    getProjectIntegrations: vi.fn().mockResolvedValue({}),
    getAllProjects: vi.fn().mockResolvedValue([]),
  };
}

describe("pagerduty data sources", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getActiveIncidents.mockReset();
    getRecentIncidents.mockReset();
    getServices.mockReset();
    getOnCalls.mockReset();
  });

  it("returns configured false when the api token is missing", async () => {
    const ctx = stubCtx(null);

    await expect(pagerdutyIncidentsDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
    await expect(pagerdutyServicesDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
    await expect(pagerdutyOnCallDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
  });

  it("computes incident counts from active and recent incidents", async () => {
    getActiveIncidents.mockResolvedValue([
      { id: "1", status: "triggered" },
      { id: "2", status: "acknowledged" },
      { id: "3", status: "triggered" },
    ]);
    getRecentIncidents.mockResolvedValue([{ id: "4", status: "resolved" }]);
    const ctx = stubCtx({ apiToken: "pd-token" });

    await expect(pagerdutyIncidentsDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      activeIncidents: [
        { id: "1", status: "triggered" },
        { id: "2", status: "acknowledged" },
        { id: "3", status: "triggered" },
      ],
      recentIncidents: [{ id: "4", status: "resolved" }],
      activeCount: 3,
      triggeredCount: 2,
      acknowledgedCount: 1,
    });
  });

  it("delegates services and on-call fetches", async () => {
    getServices.mockResolvedValue([{ id: "svc-1" }]);
    getOnCalls.mockResolvedValue([{ user: { summary: "Primary" } }]);
    const ctx = stubCtx({ apiToken: "pd-token" });

    await expect(pagerdutyServicesDataSource.fetch(stubParams, ctx)).resolves.toEqual([
      { id: "svc-1" },
    ]);
    await expect(pagerdutyOnCallDataSource.fetch(stubParams, ctx)).resolves.toEqual([
      { user: { summary: "Primary" } },
    ]);
  });
});
