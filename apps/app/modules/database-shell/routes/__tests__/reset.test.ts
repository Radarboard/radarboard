import { beforeEach, describe, expect, it, vi } from "vitest";

const performFactoryReset = vi.fn();

vi.mock("@/lib/system/factory-reset", () => ({
  performFactoryReset: () => performFactoryReset(),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { handleFactoryReset } from "@/modules/database-shell/routes/reset";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/system/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  performFactoryReset.mockResolvedValue({ cleared: ["cache", "settings"], errors: [] });
});

describe("POST /api/system/reset", () => {
  it("performs the reset when confirmed", async () => {
    const res = await handleFactoryReset(postRequest({ confirm: "ERASE" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.cleared).toContain("cache");
    expect(performFactoryReset).toHaveBeenCalledTimes(1);
  });

  it("rejects without the ERASE confirmation and does not reset", async () => {
    const res = await handleFactoryReset(postRequest({}));

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(performFactoryReset).not.toHaveBeenCalled();
  });

  it("rejects a wrong confirmation value", async () => {
    const res = await handleFactoryReset(postRequest({ confirm: "erase" }));

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(performFactoryReset).not.toHaveBeenCalled();
  });

  it("surfaces a partial failure as an error instead of reporting success", async () => {
    performFactoryReset.mockResolvedValue({
      cleared: ["cache"],
      errors: ["credentials: disk full"],
    });

    const res = await handleFactoryReset(postRequest({ confirm: "ERASE" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.error).toContain("credentials: disk full");
    expect(json.errors).toEqual(["credentials: disk full"]);
  });
});
