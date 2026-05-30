import type { Project } from "@radarboard/types/project";
import { describe, expect, it } from "vitest";
import { resolveObservabilityMode } from "./capabilities";

const SENTRY_PROJECT: Project = {
  id: "1",
  name: "Sentry Project",
  slug: "sentry-project",
  color: "#000",
  platforms: [{ id: "ios", name: "iOS", type: "ios", integrations: { sentry: {} } }],
};

const APP_STORE_PROJECT: Project = {
  id: "2",
  name: "App Store Project",
  slug: "app-store-project",
  color: "#111",
  platforms: [{ id: "ios", name: "iOS", type: "ios", integrations: { appStoreConnect: {} } }],
};

const HEALTH_PROJECT: Project = {
  id: "3",
  name: "Health Project",
  slug: "health-project",
  color: "#222",
  platforms: [{ id: "web", name: "Web", type: "web_app", integrations: { betterstack: {} } }],
};

describe("resolveObservabilityMode", () => {
  it("prefers errors when Sentry is connected", () => {
    expect(resolveObservabilityMode([SENTRY_PROJECT, APP_STORE_PROJECT], "sentry-project")).toBe(
      "sentry"
    );
  });

  it("falls back to health mode when only app reviews are connected", () => {
    expect(resolveObservabilityMode([APP_STORE_PROJECT], "app-store-project")).toBe("health");
  });

  it("falls back to health monitors when no higher-priority provider is connected", () => {
    expect(resolveObservabilityMode([HEALTH_PROJECT], "health-project")).toBe("health");
  });
});
