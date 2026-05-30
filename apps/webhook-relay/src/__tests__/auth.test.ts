import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Must set env before importing the module under test
const TEST_SECRET = "test-poll-secret-12345";

describe("verifyPollAuth", () => {
  beforeEach(() => {
    process.env.RELAY_POLL_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.RELAY_POLL_SECRET;
    vi.restoreAllMocks();
  });

  it("should return false when auth header is undefined", async () => {
    const { verifyPollAuth } = await import("../lib/auth.js");
    expect(verifyPollAuth(undefined)).toBe(false);
  });

  it("should return false when auth header has no Bearer prefix", async () => {
    const { verifyPollAuth } = await import("../lib/auth.js");
    expect(verifyPollAuth("Basic dXNlcjpwYXNz")).toBe(false);
  });

  it("should return false when token does not match", async () => {
    const { verifyPollAuth } = await import("../lib/auth.js");
    expect(verifyPollAuth("Bearer wrong-token")).toBe(false);
  });

  it("should return true when token matches", async () => {
    const { verifyPollAuth } = await import("../lib/auth.js");
    expect(verifyPollAuth(`Bearer ${TEST_SECRET}`)).toBe(true);
  });

  it("should return false when RELAY_POLL_SECRET is not set", async () => {
    delete process.env.RELAY_POLL_SECRET;
    const { verifyPollAuth } = await import("../lib/auth.js");
    expect(verifyPollAuth(`Bearer ${TEST_SECRET}`)).toBe(false);
  });

  it("should return false for empty token after Bearer prefix", async () => {
    const { verifyPollAuth } = await import("../lib/auth.js");
    expect(verifyPollAuth("Bearer ")).toBe(false);
  });

  it("should return false for lowercase bearer prefix", async () => {
    const { verifyPollAuth } = await import("../lib/auth.js");
    expect(verifyPollAuth(`bearer ${TEST_SECRET}`)).toBe(false);
  });

  it("should return false for token with extra whitespace", async () => {
    const { verifyPollAuth } = await import("../lib/auth.js");
    // Extra space after Bearer should cause token mismatch
    expect(verifyPollAuth(`Bearer  ${TEST_SECRET}`)).toBe(false);
  });

  it("should return false for empty string header", async () => {
    const { verifyPollAuth } = await import("../lib/auth.js");
    expect(verifyPollAuth("")).toBe(false);
  });

  it("should support poll secret rotation with comma-separated values", async () => {
    process.env.RELAY_POLL_SECRET = "new-secret,old-secret";
    const { verifyPollAuth } = await import("../lib/auth.js");
    // Both old and new secrets should work
    expect(verifyPollAuth("Bearer new-secret")).toBe(true);
    expect(verifyPollAuth("Bearer old-secret")).toBe(true);
    expect(verifyPollAuth("Bearer wrong-secret")).toBe(false);
  });

  it("should handle single poll secret (no comma)", async () => {
    process.env.RELAY_POLL_SECRET = "single-secret";
    const { verifyPollAuth } = await import("../lib/auth.js");
    expect(verifyPollAuth("Bearer single-secret")).toBe(true);
  });
});
