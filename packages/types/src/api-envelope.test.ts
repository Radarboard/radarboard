import { describe, expect, it } from "vitest";
import type { ApiEnvelope, ApiErrorResponse, ApiResponse } from "./api-envelope";

describe("ApiEnvelope types", () => {
  it("success envelope shape is correct", () => {
    const response: ApiResponse<{ items: string[] }> = {
      ok: true,
      correlationId: "abc-123",
      data: { items: ["a", "b"] },
    };
    expect(response.ok).toBe(true);
    expect(response.correlationId).toBe("abc-123");
    expect(response.data.items).toEqual(["a", "b"]);
  });

  it("error envelope shape is correct", () => {
    const response: ApiErrorResponse = {
      ok: false,
      correlationId: "abc-123",
      error: { code: "NOT_FOUND", message: "Not found" },
    };
    expect(response.ok).toBe(false);
    expect(response.error.code).toBe("NOT_FOUND");
  });

  it("discriminated union narrows correctly", () => {
    const envelope: ApiEnvelope<string> = {
      ok: true,
      correlationId: "x",
      data: "hello",
    };

    if (envelope.ok) {
      expect(envelope.data).toBe("hello");
    } else {
      // This branch should not execute
      expect.unreachable();
    }
  });
});
