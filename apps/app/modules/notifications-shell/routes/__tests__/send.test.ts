import { beforeEach, describe, expect, it, vi } from "vitest";

const sendAlertViaResendMock = vi.fn();
const resolveResendConfigMock = vi.fn();
const emitNotificationEventMock = vi.fn();

vi.mock("@radarboard/integration-resend/server/alerts", () => ({
  sendAlertViaResend: (...args: unknown[]) => sendAlertViaResendMock(...args),
}));

vi.mock("@/lib/credential-resolver", () => ({
  resolveResendConfig: (...args: unknown[]) => resolveResendConfigMock(...args),
}));

vi.mock("@/lib/notifications", () => ({
  emitNotificationEvent: (...args: unknown[]) => emitNotificationEventMock(...args),
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
  sendAlertViaResendMock.mockReset();
  resolveResendConfigMock.mockReset();
  emitNotificationEventMock.mockReset();
});

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/notifications/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/notifications/send", () => {
  it("returns 200 with configured=false when Resend is not configured", async () => {
    resolveResendConfigMock.mockResolvedValue(null);

    const res = await POST(
      makeRequest({ type: "health", name: "API", url: "https://api.test", status: "down" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.configured).toBe(false);
    expect(body.error).toBe("Resend not configured");
  });

  it("sends alert and returns success with emailId", async () => {
    const config = { apiKey: "re_xxx", from: "alerts@test.com", to: "user@test.com" };
    resolveResendConfigMock.mockResolvedValue(config);
    sendAlertViaResendMock.mockResolvedValue({
      ok: true,
      emailId: "email_abc123",
      notification: {
        type: "health.down",
        severity: "critical",
        title: "API is down",
      },
    });
    emitNotificationEventMock.mockResolvedValue(undefined);

    const res = await POST(
      makeRequest({
        type: "health",
        name: "API",
        url: "https://api.test",
        status: "down",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.sent).toBe(true);
    expect(body.emailId).toBe("email_abc123");
  });

  it("emits notification event after sending", async () => {
    resolveResendConfigMock.mockResolvedValue({ apiKey: "re_xxx" });
    sendAlertViaResendMock.mockResolvedValue({
      ok: true,
      emailId: "email_xyz",
      notification: {
        type: "health.down",
        severity: "critical",
        title: "Service down",
      },
    });

    await POST(makeRequest({ type: "health" }));

    expect(emitNotificationEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "alerts",
        type: "health.down",
      })
    );
  });

  it("returns error status from sendAlertViaResend on failure", async () => {
    resolveResendConfigMock.mockResolvedValue({ apiKey: "re_xxx" });
    sendAlertViaResendMock.mockResolvedValue({
      ok: false,
      error: "Rate limited",
      status: 429,
    });

    const res = await POST(makeRequest({ type: "health" }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe("Rate limited");
  });

  it("returns 500 on unexpected exception", async () => {
    resolveResendConfigMock.mockResolvedValue({ apiKey: "re_xxx" });
    sendAlertViaResendMock.mockRejectedValue(new Error("Network error"));

    const res = await POST(makeRequest({ type: "health" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Network error");
    expect(body.configured).toBe(true);
  });
});
