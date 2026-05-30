import { describe, expect, it } from "vitest";
import {
  extractLegacyProjectPackages,
  filterPackages,
  matchesPackagePattern,
  parsePackageList,
} from "./utils";

describe("npm utils", () => {
  it("parses package lists from textarea-style input", () => {
    expect(parsePackageList("@acme/a, @acme/b\n@acme/c")).toEqual([
      "@acme/a",
      "@acme/b",
      "@acme/c",
    ]);
  });

  it("matches exact package names and glob patterns", () => {
    expect(matchesPackagePattern("@acme/core", "@acme/core")).toBe(true);
    expect(matchesPackagePattern("@acme/experimental-ui", "@acme/experimental-*")).toBe(true);
    expect(matchesPackagePattern("@acme/core", "@acme/experimental-*")).toBe(false);
  });

  it("applies include rules before exclude rules", () => {
    expect(
      filterPackages(
        ["@acme/core", "@acme/experimental-ui", "@acme/experimental-api", "@acme/docs"],
        {
          include: ["@acme/*"],
          exclude: ["@acme/experimental-*"],
        }
      )
    ).toEqual(["@acme/core", "@acme/docs"]);
  });

  it("deduplicates legacy project package entries", () => {
    expect(
      extractLegacyProjectPackages([
        {
          platforms: [
            { integrations: { npm: { packageName: "@acme/core" } } },
            { integrations: { npm: { packageName: "@acme/core" } } },
          ],
        },
        {
          platforms: [{ integrations: { npm: { packageName: "@acme/docs" } } }],
        },
      ])
    ).toEqual(["@acme/core", "@acme/docs"]);
  });
});
