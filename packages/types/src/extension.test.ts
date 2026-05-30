import { describe, expect, it } from "vitest";
import { CAPABILITY_IDS, type CapabilityId, isCapabilityId } from "./extension";

describe("extension capability metadata", () => {
  it("exposes the supported capability ids", () => {
    expect(CAPABILITY_IDS).toEqual([
      "revenue",
      "bookmarks",
      "stars",
      "domains",
      "errors",
      "uptime",
      "app-reviews",
      "downloads",
      "sponsorship",
      "shipping",
      "analytics",
      "seo",
    ] satisfies CapabilityId[]);
  });

  it("validates capability ids", () => {
    expect(isCapabilityId("revenue")).toBe(true);
    expect(isCapabilityId("not-a-capability")).toBe(false);
  });
});
