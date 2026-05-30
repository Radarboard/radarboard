import type { CommonRouteParams, DataSourceContext } from "@radarboard/integration-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const getRevenueSummary = vi.fn();
const getDailyRevenue = vi.fn();
const getRecentCharges = vi.fn();

vi.mock("./client", () => ({
  getRevenueSummary: (...args: unknown[]) => getRevenueSummary(...args),
  getDailyRevenue: (...args: unknown[]) => getDailyRevenue(...args),
  getRecentCharges: (...args: unknown[]) => getRecentCharges(...args),
}));

import {
  stripeChargesDataSource,
  stripeDailyRevenueDataSource,
  stripeRevenueSummaryDataSource,
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

describe("stripe data sources", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getRevenueSummary.mockReset();
    getDailyRevenue.mockReset();
    getRecentCharges.mockReset();
  });

  it("returns configured false when the secret key is missing", async () => {
    const ctx = stubCtx(null);

    await expect(stripeRevenueSummaryDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
    await expect(stripeDailyRevenueDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
    await expect(stripeChargesDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      configured: false,
    });
  });

  it("delegates to stripe client helpers when configured", async () => {
    getRevenueSummary.mockResolvedValue({ mrr: 2500 });
    getDailyRevenue.mockResolvedValue([{ date: "2026-03-18", amount: 4000, count: 2 }]);
    getRecentCharges.mockResolvedValue([{ id: "charge-1" }]);
    const ctx = stubCtx({ secretKey: "sk_test" });

    await expect(stripeRevenueSummaryDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      mrr: 2500,
    });
    await expect(stripeDailyRevenueDataSource.fetch(stubParams, ctx)).resolves.toEqual([
      { date: "2026-03-18", amount: 4000, count: 2 },
    ]);
    await expect(stripeChargesDataSource.fetch(stubParams, ctx)).resolves.toEqual([
      { id: "charge-1" },
    ]);
  });
});
