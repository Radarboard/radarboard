import { afterEach, describe, expect, it, vi } from "vitest";

// Reset module cache between tests so validateEnv() re-runs
afterEach(() => {
  vi.resetModules();
});

describe("env validation", () => {
  it("passes with required vars set", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key-32chars-long-enough-ok!");
    vi.stubEnv("RADARBOARD_API_SECRET", "test-secret");

    const { validateEnv } = await import("../env");
    const env = validateEnv();

    expect(env.ENCRYPTION_KEY).toBe("test-key-32chars-long-enough-ok!");
    expect(env.RADARBOARD_API_SECRET).toBe("test-secret");
  });

  it("throws when ENCRYPTION_KEY is missing", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    vi.stubEnv("RADARBOARD_API_SECRET", "test-secret");

    const { validateEnv } = await import("../env");

    expect(() => validateEnv()).toThrow("Environment validation failed");
    expect(() => validateEnv()).toThrow("ENCRYPTION_KEY");
  });

  it("throws when RADARBOARD_API_SECRET is missing", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key");
    vi.stubEnv("RADARBOARD_API_SECRET", "");

    const { validateEnv } = await import("../env");

    expect(() => validateEnv()).toThrow("RADARBOARD_API_SECRET");
  });

  it("lists all missing vars in a single error", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    vi.stubEnv("RADARBOARD_API_SECRET", "");

    const { validateEnv } = await import("../env");

    try {
      validateEnv();
      expect.unreachable();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("ENCRYPTION_KEY");
      expect(message).toContain("RADARBOARD_API_SECRET");
    }
  });

  it("accepts optional vars as undefined", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key");
    vi.stubEnv("RADARBOARD_API_SECRET", "test-secret");

    const { validateEnv } = await import("../env");
    const env = validateEnv();

    expect(env.BACKUP_SECRET).toBeUndefined();
    expect(env.PIPER_COMMAND).toBeUndefined();
  });

  it("getWebEnv returns undefined for empty values", async () => {
    vi.stubEnv("SOME_VAR", "");

    const { getWebEnv } = await import("../env");
    expect(getWebEnv("SOME_VAR")).toBeUndefined();
  });

  it("getWebEnv returns the value for non-empty values", async () => {
    vi.stubEnv("SOME_VAR", "hello");

    const { getWebEnv } = await import("../env");
    expect(getWebEnv("SOME_VAR")).toBe("hello");
  });

  it("getWebBooleanEnv returns true for '1'", async () => {
    vi.stubEnv("FLAG", "1");

    const { getWebBooleanEnv } = await import("../env");
    expect(getWebBooleanEnv("FLAG")).toBe(true);
  });

  it("getWebBooleanEnv returns false for anything else", async () => {
    vi.stubEnv("FLAG", "0");

    const { getWebBooleanEnv } = await import("../env");
    expect(getWebBooleanEnv("FLAG")).toBe(false);
  });
});
