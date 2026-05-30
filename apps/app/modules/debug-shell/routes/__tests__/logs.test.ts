import { beforeEach, describe, expect, it, vi } from "vitest";

const getEntriesMock = vi.fn();
const clearMock = vi.fn();

vi.mock("@radarboard/logger/log-buffer", () => ({
  logBuffer: {
    getEntries: (...args: unknown[]) => getEntriesMock(...args),
    clear: (...args: unknown[]) => clearMock(...args),
  },
}));

import { handleClearLogs as DELETE, handleGetLogs as GET } from "@/modules/debug-shell/routes/logs";

beforeEach(() => {
  getEntriesMock.mockReset();
  clearMock.mockReset();
});

describe("GET /api/dev/logs", () => {
  it("returns log entries with no filters", async () => {
    const entries = [{ id: "1", level: "info", message: "hello", timestamp: 1700000000 }];
    getEntriesMock.mockReturnValue(entries);

    const res = GET(new Request("http://localhost/api/logs"));
    const body = await res.json();

    expect(body).toEqual(entries);
    expect(getEntriesMock).toHaveBeenCalledWith({
      level: undefined,
      source: undefined,
      search: undefined,
      after: undefined,
      limit: undefined,
    });
  });

  it("passes filter params to logBuffer", async () => {
    getEntriesMock.mockReturnValue([]);

    GET(
      new Request(
        "http://localhost/api/logs?level=error&source=api&search=fail&after=1700000000&limit=50"
      )
    );

    expect(getEntriesMock).toHaveBeenCalledWith({
      level: "error",
      source: "api",
      search: "fail",
      after: 1700000000,
      limit: 50,
    });
  });

  it("converts after and limit to numbers", async () => {
    getEntriesMock.mockReturnValue([]);

    GET(new Request("http://localhost/api/logs?after=123&limit=10"));

    const call = getEntriesMock.mock.calls[0][0];
    expect(typeof call.after).toBe("number");
    expect(typeof call.limit).toBe("number");
  });
});

describe("DELETE /api/dev/logs", () => {
  it("clears the log buffer", async () => {
    const res = DELETE();
    const body = await res.json();

    expect(body.cleared).toBe(true);
    expect(clearMock).toHaveBeenCalled();
  });
});
