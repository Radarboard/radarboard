import { describe, expect, it } from "vitest";
import { createSession, sessionCachePrefix } from "../dashboard-session";

describe("DashboardSession", () => {
  it("creates a session with defaults", () => {
    const session = createSession();
    expect(session.id).toBeTruthy();
    expect(session.projectSlug).toBeNull();
    expect(session.timeRange).toBe("30d");
    expect(session.activePluginId).toBeNull();
    expect(session.createdAt).toBeGreaterThan(0);
  });

  it("accepts overrides", () => {
    const session = createSession({ projectSlug: "my-app", timeRange: "7d" });
    expect(session.projectSlug).toBe("my-app");
    expect(session.timeRange).toBe("7d");
  });

  it("builds a cache prefix with project slug", () => {
    const session = createSession({ projectSlug: "my-app" });
    expect(sessionCachePrefix(session)).toBe(`session:${session.id}:my-app`);
  });

  it("builds a cache prefix without project slug", () => {
    const session = createSession();
    expect(sessionCachePrefix(session)).toBe(`session:${session.id}:all`);
  });
});
