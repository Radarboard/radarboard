import { beforeEach, describe, expect, it, vi } from "vitest";

const executeListUserIntegrations = vi.fn();
const executeRemoveIntegration = vi.fn();

vi.mock("@/lib/ai-actions/dashboard/connect-integration", () => ({
  executeListUserIntegrations: () => executeListUserIntegrations(),
  executeRemoveIntegration: (...args: unknown[]) => executeRemoveIntegration(...args),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { handleListUserIntegrations, handleRemoveUserIntegration } from "../user-integrations";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleListUserIntegrations", () => {
  it("returns the integrations payload", async () => {
    executeListUserIntegrations.mockResolvedValue({
      integrations: [{ id: "acme", name: "Acme" }],
    });
    const res = await handleListUserIntegrations();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ integrations: [{ id: "acme", name: "Acme" }] });
  });

  it("returns 500 when the executor throws", async () => {
    executeListUserIntegrations.mockRejectedValue(new Error("boom"));
    const res = await handleListUserIntegrations();
    expect(res.status).toBe(500);
  });
});

describe("handleRemoveUserIntegration", () => {
  it("rejects an empty id with 400", async () => {
    const res = await handleRemoveUserIntegration("");
    expect(res.status).toBe(400);
    expect(executeRemoveIntegration).not.toHaveBeenCalled();
  });

  it("returns the removal result on success", async () => {
    executeRemoveIntegration.mockResolvedValue({ removed: true, id: "acme", notFound: false });
    const res = await handleRemoveUserIntegration("acme");
    expect(executeRemoveIntegration).toHaveBeenCalledWith({ id: "acme" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ removed: true, id: "acme" });
  });

  it("is idempotent: unknown id still returns 200", async () => {
    executeRemoveIntegration.mockResolvedValue({ removed: false, id: "ghost", notFound: true });
    const res = await handleRemoveUserIntegration("ghost");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ removed: false, notFound: true });
  });

  it("surfaces an executor error as 500", async () => {
    executeRemoveIntegration.mockResolvedValue({ removed: false, id: "acme", error: "db down" });
    const res = await handleRemoveUserIntegration("acme");
    expect(res.status).toBe(500);
  });
});
