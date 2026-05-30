import { describe, expect, it } from "vitest";
import { normalizeOAuthOrigin } from "../oauth-redirect";

describe("normalizeOAuthOrigin", () => {
  it("strips localhost subdomains and preserves https", () => {
    expect(normalizeOAuthOrigin("https://radarboard.localhost:1355")).toBe(
      "https://localhost:1355"
    );
  });

  it("strips localhost subdomains and preserves http", () => {
    expect(normalizeOAuthOrigin("http://radarboard.localhost:1355")).toBe("http://localhost:1355");
  });

  it("leaves plain localhost unchanged", () => {
    expect(normalizeOAuthOrigin("https://localhost:1355")).toBe("https://localhost:1355");
  });

  it("leaves non-localhost origins unchanged", () => {
    expect(normalizeOAuthOrigin("https://radarboard.example.com")).toBe(
      "https://radarboard.example.com"
    );
  });
});
