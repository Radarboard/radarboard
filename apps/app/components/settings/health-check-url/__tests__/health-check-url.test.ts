import { describe, expect, it } from "vitest";
import { buildHealthCheckSuggestions, inferHealthCheckBaseUrl } from "../";

describe("health-check-url helpers", () => {
  it("infers a base url from a website platform name", () => {
    expect(inferHealthCheckBaseUrl("website", "goshuin.com")).toBe("https://goshuin.com");
  });

  it("prefers the current value origin when already set", () => {
    expect(inferHealthCheckBaseUrl("website", "goshuin.com", "https://goshuin.com/status")).toBe(
      "https://goshuin.com"
    );
  });

  it("does not infer website defaults for non-web platforms", () => {
    expect(inferHealthCheckBaseUrl("ios", "iOS App")).toBeNull();
  });

  it("builds root and common health endpoint suggestions", () => {
    expect(buildHealthCheckSuggestions("website", "goshuin.com")).toEqual([
      "https://goshuin.com",
      "https://goshuin.com/api/health",
      "https://goshuin.com/health",
    ]);
  });

  it("prefers /api/health first for web apps", () => {
    expect(buildHealthCheckSuggestions("web_app", "goshuin.com")).toEqual([
      "https://goshuin.com/api/health",
      "https://goshuin.com",
      "https://goshuin.com/health",
    ]);
  });
});
