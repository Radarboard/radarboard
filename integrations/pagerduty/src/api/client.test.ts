import { afterEach, describe, expect, it, vi } from "vitest";
import { getActiveIncidents, getOnCalls, getRecentIncidents, getServices } from "./client";

describe("pagerduty client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("maps active incidents, services, and on-calls from the api", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ incidents: [{ id: "inc-1", status: "triggered" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ incidents: [{ id: "inc-2", status: "resolved" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: [{ id: "svc-1", name: "API" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ oncalls: [{ user: { summary: "Primary" } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const config = { apiToken: "pd-token" };

    await expect(getActiveIncidents(config, 10)).resolves.toEqual([
      { id: "inc-1", status: "triggered" },
    ]);
    await expect(getRecentIncidents(config, 10)).resolves.toEqual([
      { id: "inc-2", status: "resolved" },
    ]);
    await expect(getServices(config)).resolves.toEqual([{ id: "svc-1", name: "API" }]);
    await expect(getOnCalls(config)).resolves.toEqual([{ user: { summary: "Primary" } }]);
  });

  it("marks server failures as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "temporary outage",
      })
    );

    await expect(getActiveIncidents({ apiToken: "pd-token" }, 99)).rejects.toMatchObject({
      status: 503,
      retryable: true,
    });
  });

  it("uses cached responses until expiry and treats 400s as non-retryable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T00:00:00.000Z"));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ incidents: [{ id: "inc-1", status: "resolved" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ incidents: [{ id: "inc-2", status: "resolved" }] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "bad request",
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRecentIncidents({ apiToken: "pd-token" }, 77)).resolves.toEqual([
      { id: "inc-1", status: "resolved" },
    ]);
    await expect(getRecentIncidents({ apiToken: "pd-token" }, 77)).resolves.toEqual([
      { id: "inc-1", status: "resolved" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2 * 60 * 1000 + 1);

    await expect(getRecentIncidents({ apiToken: "pd-token" }, 77)).resolves.toEqual([
      { id: "inc-2", status: "resolved" },
    ]);
    await expect(getActiveIncidents({ apiToken: "pd-token" }, 101)).rejects.toMatchObject({
      status: 400,
      retryable: false,
    });
  });
});
