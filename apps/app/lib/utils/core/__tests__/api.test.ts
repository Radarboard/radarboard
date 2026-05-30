import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ApiRouteError,
  badRequest,
  envelopeError,
  envelopeSuccess,
  errorJson,
  errorResponse,
  getCorrelationId,
  handleRoute,
  internalError,
  parseBody,
  parseFormData,
  parseSearchParams,
  parseUrlEncodedBody,
} from "../api";

describe("getCorrelationId", () => {
  it("returns header value when present", () => {
    const request = new Request("https://example.com", {
      headers: { "X-Correlation-Id": "test-123" },
    });
    expect(getCorrelationId(request)).toBe("test-123");
  });

  it("generates UUID when header missing", () => {
    const request = new Request("https://example.com");
    const id = getCorrelationId(request);
    expect(id).toMatch(/^[0-9a-f]{8}-/);
  });

  it("generates UUID when no request provided", () => {
    const id = getCorrelationId();
    expect(id).toMatch(/^[0-9a-f]{8}-/);
  });
});

describe("envelopeSuccess", () => {
  it("wraps data in ok envelope with correlation ID header", async () => {
    const res = envelopeSuccess({ count: 42 }, "cid-1");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Correlation-Id")).toBe("cid-1");
    expect(body.ok).toBe(true);
    expect(body.correlationId).toBe("cid-1");
    expect(body.data.count).toBe(42);
  });

  it("supports custom status code", async () => {
    const res = envelopeSuccess(null, "cid-2", 201);
    expect(res.status).toBe(201);
  });
});

describe("envelopeError", () => {
  it("wraps error in envelope with code and message", async () => {
    const res = envelopeError("NOT_FOUND", "Widget not found", "cid-3", 404);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Widget not found");
  });

  it("includes metadata when provided", async () => {
    const res = envelopeError("RATE_LIMITED", "Too fast", "cid-4", 429, { retryAfter: 60 });
    const body = await res.json();
    expect(body.error.metadata.retryAfter).toBe(60);
  });

  it("defaults to 500 status", async () => {
    const res = envelopeError("INTERNAL", "Boom", "cid-5");
    expect(res.status).toBe(500);
  });
});

describe("errorResponse", () => {
  it("handles ApiRouteError", async () => {
    const res = errorResponse(new ApiRouteError(404, "Missing record", "NOT_FOUND"));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toBe("Missing record");
    expect(body.code).toBe("NOT_FOUND");
  });

  it("handles plain Error", async () => {
    const res = errorResponse(new Error("something broke"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("something broke");
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("handles non-Error values", async () => {
    const res = errorResponse("string error");
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });
});

describe("internalError", () => {
  it("formats contextual internal errors consistently", () => {
    const err = internalError(new Error("DB unavailable"), "Failed to load settings");
    expect(err.status).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.message).toBe("Failed to load settings: DB unavailable");
  });
});

describe("errorJson", () => {
  it("creates flat error responses with code and extras", async () => {
    const res = errorJson(500, "boom", { configured: true }, "INTERNAL_ERROR");
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("boom");
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.configured).toBe(true);
  });
});

describe("handleRoute", () => {
  it("returns successful responses unchanged", async () => {
    const res = await handleRoute(() => Response.json({ ok: true }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("serializes ApiRouteError responses", async () => {
    const res = await handleRoute(() => {
      throw badRequest("title is required");
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("title is required");
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("adds context for unknown errors", async () => {
    const res = await handleRoute(
      () => {
        throw new Error("timeout");
      },
      { context: "Failed to update conversation" }
    );
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to update conversation: timeout");
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});

describe("parseBody", () => {
  const schema = z.object({ name: z.string(), age: z.number() });

  it("parses valid JSON body", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ name: "Alice", age: 30 }),
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseBody(request, schema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Alice");
      expect(result.data.age).toBe(30);
    }
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseBody(request, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it("returns 400 for schema mismatch", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ name: 123 }),
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseBody(request, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });
});

describe("parseSearchParams", () => {
  const schema = z.object({ page: z.coerce.number().default(1) });

  it("parses valid search params", () => {
    const params = new URLSearchParams("page=5");
    const result = parseSearchParams(params, schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.page).toBe(5);
  });

  it("applies defaults for missing params", () => {
    const params = new URLSearchParams();
    const result = parseSearchParams(params, schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.page).toBe(1);
  });

  it("returns 400 for invalid params", () => {
    const strictSchema = z.object({ id: z.string().uuid() });
    const params = new URLSearchParams("id=not-a-uuid");
    const result = parseSearchParams(params, strictSchema);
    expect(result.ok).toBe(false);
  });
});

describe("parseFormData", () => {
  const schema = z.object({ action: z.string(), token: z.string() });

  it("parses valid form data", async () => {
    const body = new URLSearchParams({ action: "allow", token: "abc" });
    const request = new Request("https://example.com", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const result = await parseFormData(request, schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.action).toBe("allow");
  });
});

describe("parseUrlEncodedBody", () => {
  const schema = z.object({ grant_type: z.string(), code: z.string() });

  it("parses valid urlencoded data", async () => {
    const body = new URLSearchParams({ grant_type: "authorization_code", code: "abc" });
    const request = new Request("https://example.com", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const result = await parseUrlEncodedBody(request, schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.code).toBe("abc");
  });
});
