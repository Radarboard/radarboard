import { afterEach, describe, expect, it, vi } from "vitest";
import { getDailyRevenue, getRecentCharges, getRevenueSummary } from "./client";

describe("stripe client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("calculates revenue summary values from subscriptions and charges", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: "list",
          data: [
            {
              id: "sub-month",
              items: { data: [{ plan: { amount: 2500, interval: "month", currency: "usd" } }] },
            },
            {
              id: "sub-year",
              items: { data: [{ plan: { amount: 12000, interval: "year", currency: "usd" } }] },
            },
            {
              id: "sub-eur",
              items: { data: [{ plan: { amount: 3000, interval: "month", currency: "eur" } }] },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: "list",
          data: [
            { id: "c-1", amount: 5000, currency: "usd" },
            { id: "c-2", amount: 3000, currency: "usd" },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: "list",
          data: [{ id: "c-3", amount: 2000, currency: "usd" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: "list",
          data: [
            { id: "new-1", canceled_at: null },
            { id: "new-2", canceled_at: 1_700_000_000 },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRevenueSummary({ secretKey: "sk_test" })).resolves.toEqual({
      mrr: 3500,
      revenueThisMonth: 8000,
      revenueLastMonth: 2000,
      activeSubscriptions: 3,
      newSubscriptions: 2,
      churnedSubscriptions: 1,
      currency: "usd",
    });
  });

  it("groups daily revenue and exposes recent charges", async () => {
    const createdA = Math.floor(new Date("2026-03-18T12:00:00.000Z").getTime() / 1000);
    const createdB = Math.floor(new Date("2026-03-19T12:00:00.000Z").getTime() / 1000);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: "list",
          data: [
            { id: "ch-1", amount: 1500, created: createdA, status: "succeeded" },
            { id: "ch-2", amount: 2500, created: createdA, status: "succeeded" },
            { id: "ch-3", amount: 3000, created: createdB, status: "succeeded" },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: "list",
          data: [{ id: "recent-1", amount: 5000, status: "succeeded" }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDailyRevenue({ secretKey: "sk_test" }, 14)).resolves.toEqual([
      { date: "2026-03-18", amount: 4000, count: 2 },
      { date: "2026-03-19", amount: 3000, count: 1 },
    ]);
    await expect(getRecentCharges({ secretKey: "sk_test" }, 5)).resolves.toEqual([
      { id: "recent-1", amount: 5000, status: "succeeded" },
    ]);
  });

  it("marks 500s as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "stripe exploded",
      })
    );

    await expect(getRecentCharges({ secretKey: "sk_test" })).rejects.toMatchObject({
      status: 500,
      retryable: true,
    });
  });

  it("re-fetches after cache expiry and treats 400s as non-retryable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T00:00:00.000Z"));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: "list",
          data: [{ id: "charge-1", amount: 1000, status: "succeeded" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: "list",
          data: [{ id: "charge-2", amount: 2000, status: "succeeded" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "bad request",
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRecentCharges({ secretKey: "sk_test" }, 2)).resolves.toEqual([
      { id: "charge-1", amount: 1000, status: "succeeded" },
    ]);
    await expect(getRecentCharges({ secretKey: "sk_test" }, 2)).resolves.toEqual([
      { id: "charge-1", amount: 1000, status: "succeeded" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    await expect(getRecentCharges({ secretKey: "sk_test" }, 2)).resolves.toEqual([
      { id: "charge-2", amount: 2000, status: "succeeded" },
    ]);
    await expect(getDailyRevenue({ secretKey: "sk_test" }, 5)).rejects.toMatchObject({
      status: 400,
      retryable: false,
    });
  });
});
