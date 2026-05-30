import { describe, expect, it } from "vitest";
import { resolveServiceDeepLink } from "../use-deeplink";

describe("resolveServiceDeepLink", () => {
  it("returns null when no service param is provided", () => {
    expect(resolveServiceDeepLink(null, new Set(["github", "vercel"]))).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(resolveServiceDeepLink("", new Set(["github"]))).toBeNull();
  });

  it("returns the service ID when it matches a known service", () => {
    const known = new Set(["github", "vercel", "sentry"]);
    expect(resolveServiceDeepLink("github", known)).toBe("github");
  });

  it("returns null when service ID is not in the known set", () => {
    const known = new Set(["github", "vercel"]);
    expect(resolveServiceDeepLink("unknown-service", known)).toBeNull();
  });

  it("is case-sensitive — does not match wrong case", () => {
    const known = new Set(["github"]);
    expect(resolveServiceDeepLink("GitHub", known)).toBeNull();
  });
});
