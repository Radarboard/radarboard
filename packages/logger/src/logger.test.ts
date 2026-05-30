import { API_ROUTES } from "@radarboard/types/api-routes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logBuffer } from "./log-buffer";
import { createLogger, getLogLevel, setLogLevel } from "./logger";
import { withLogging } from "./middleware";

describe("logger", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  beforeEach(() => {
    logBuffer.clear();
    setLogLevel("debug");
  });

  afterEach(() => {
    stdoutSpy.mockClear();
    setLogLevel("debug");
  });

  it("honors the minimum log level when writing entries", () => {
    setLogLevel("warn");
    const logger = createLogger("worker/cache");

    logger.info("cache miss");
    logger.warn("cache stale");

    const logs = logBuffer.getEntries({ limit: 10 }).logs;

    expect(getLogLevel()).toBe("warn");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      source: "worker/cache",
      level: "warn",
      message: "cache stale",
    });
  });

  it("logs request start and failure around wrapped handlers", async () => {
    const error = new Error("boom");
    const handler = withLogging(API_ROUTES.settings, async () => {
      throw error;
    });

    await expect(
      handler(new Request(`https://radarboard.app${API_ROUTES.settings}`))
    ).rejects.toThrow("boom");

    const logs = logBuffer.getEntries({ source: API_ROUTES.settings, limit: 10 }).logs;

    expect(logs.map((entry) => entry.message)).toEqual(["request started", "request failed"]);
    expect(logs[1]?.metadata).toEqual(
      expect.objectContaining({
        method: "GET",
        path: API_ROUTES.settings,
        error,
      })
    );
  });
});
