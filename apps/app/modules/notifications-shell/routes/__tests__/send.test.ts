import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveResendConfigMock = vi.fn();

vi.mock("@/lib/credential-resolver", () => ({
  resolveResendConfig: (...args: unknown[]) => resolveResendConfigMock(...args),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { handleSendAlert as POST } from "../send";

beforeEach(() => {
  resolveResendConfigMock.mockReset();
});

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/notifications/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/notifications/send", () => {
  it("returns 404 because Resend delivery is extension-owned", async () => {
    resolveResendConfigMock.mockResolvedValue({ apiKey: "re_xxx" });

    const res = await POST(
      makeRequest({ type: "health", name: "API", url: "https://api.test", status: "down" })
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.configured).toBe(true);
    expect(body.sent).toBe(false);
  });
});
