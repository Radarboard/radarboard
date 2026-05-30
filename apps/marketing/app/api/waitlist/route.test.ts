import { PRODUCT_WAITLIST_SUBJECT } from "@radarboard/product";
import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMock = vi.fn(async () => "<html>Welcome</html>");
const contactsCreateMock = vi.fn();
const emailsSendMock = vi.fn();
const waitlistWelcomeMock = vi.fn(() => null);

vi.mock("@radarboard/emails/render", () => ({
  render: renderMock,
}));

vi.mock("@radarboard/emails/waitlist-welcome", () => ({
  WaitlistWelcome: waitlistWelcomeMock,
}));

vi.mock("resend", () => ({
  Resend: class Resend {
    contacts = { create: contactsCreateMock };
    emails = { send: emailsSendMock };
  },
}));

function createRequest(ip: string, body: unknown) {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/waitlist", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "resend-key";
    process.env.RESEND_AUDIENCE_ID = "audience-id";
    process.env.RESEND_FROM_EMAIL = "hello@radarboard.app";
    contactsCreateMock.mockResolvedValue({ error: null });
    emailsSendMock.mockResolvedValue({ error: null });
  });

  it("adds a contact and sends the welcome email on success", async () => {
    const { POST } = await import("./route");

    const response = await POST(createRequest("1.1.1.1", { email: "test@example.com" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true, message: "You're in! Check your inbox." });
    expect(contactsCreateMock).toHaveBeenCalledWith({
      audienceId: "audience-id",
      email: "test@example.com",
    });
    expect(waitlistWelcomeMock).toHaveBeenCalledWith({});
    expect(renderMock).toHaveBeenCalled();
    expect(emailsSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "hello@radarboard.app",
        to: "test@example.com",
        subject: PRODUCT_WAITLIST_SUBJECT,
        html: "<html>Welcome</html>",
      })
    );
  });

  it("treats duplicate contacts as success without sending another welcome email", async () => {
    contactsCreateMock.mockResolvedValue({
      error: { statusCode: 409, message: "already exists" },
    });

    const { POST } = await import("./route");

    const response = await POST(createRequest("2.2.2.2", { email: "test@example.com" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true, message: "You're already on the list!" });
    expect(emailsSendMock).not.toHaveBeenCalled();
  });

  it("rejects invalid email addresses", async () => {
    const { POST } = await import("./route");

    const response = await POST(createRequest("3.3.3.3", { email: "not-an-email" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ success: false, message: "Invalid email address" });
    expect(contactsCreateMock).not.toHaveBeenCalled();
  });

  it("rate limits after three requests from the same client", async () => {
    const { POST } = await import("./route");

    await POST(createRequest("4.4.4.4", { email: "first@example.com" }));
    await POST(createRequest("4.4.4.4", { email: "second@example.com" }));
    await POST(createRequest("4.4.4.4", { email: "third@example.com" }));
    const response = await POST(createRequest("4.4.4.4", { email: "fourth@example.com" }));
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json).toEqual({ success: false, message: "Too many requests" });
  });
});
