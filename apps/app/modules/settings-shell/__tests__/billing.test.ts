import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebEnvMock = vi.fn();

vi.mock("@/lib/env", () => ({
  getWebEnv: (...args: unknown[]) => getWebEnvMock(...args),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { handleBillingPortal as GET } from "@/modules/settings-shell/billing";

beforeEach(() => {
  getWebEnvMock.mockReset();
});

describe("GET /api/billing/portal", () => {
  it("redirects to Lemon Squeezy portal when configured", async () => {
    getWebEnvMock.mockReturnValue("store_12345");

    const res = await GET();

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.lemonsqueezy.com/my-orders");
  });

  it("returns 500 when LEMONSQUEEZY_STORE_ID is not set", async () => {
    getWebEnvMock.mockReturnValue(undefined);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Billing not configured");
  });
});
