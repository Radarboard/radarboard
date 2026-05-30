import { describe, expect, it } from "vitest";
import {
  getProfileDefinition,
  getSuggestedBlueprints,
  getSuggestedIntegrations,
  PROFILE_GROUPS,
} from "../components/onboarding-wizard/profile-config";

describe("profile-config", () => {
  describe("PROFILE_GROUPS", () => {
    it("contains three groups", () => {
      expect(PROFILE_GROUPS).toHaveLength(3);
      expect(PROFILE_GROUPS.map((g) => g.label)).toEqual([
        "Development",
        "Product & Business",
        "Growth & Marketing",
      ]);
    });

    it("every profile has required fields", () => {
      for (const group of PROFILE_GROUPS) {
        for (const profile of group.profiles) {
          expect(profile.id).toBeTruthy();
          expect(profile.label).toBeTruthy();
          expect(profile.description).toBeTruthy();
          expect(profile.emoji).toBeTruthy();
          expect(Array.isArray(profile.suggestedIntegrations)).toBe(true);
          expect(profile.suggestedIntegrations.length).toBeGreaterThan(0);
        }
      }
    });

    it("has no duplicate profile IDs", () => {
      const ids = PROFILE_GROUPS.flatMap((g) => g.profiles.map((p) => p.id));
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("getProfileDefinition", () => {
    it("resolves a known profile by ID", () => {
      const def = getProfileDefinition("fullstack");
      expect(def).toBeDefined();
      expect(def?.label).toBe("Full-Stack Developer");
    });

    it("resolves profiles from different groups", () => {
      expect(getProfileDefinition("indie")?.label).toBe("Indie Hacker");
      expect(getProfileDefinition("seo")?.label).toBe("SEO Specialist");
      expect(getProfileDefinition("devops")?.label).toBe("DevOps / Platform");
    });

    it("returns undefined for unknown profile ID", () => {
      expect(getProfileDefinition("nonexistent" as never)).toBeUndefined();
    });
  });

  describe("getSuggestedIntegrations", () => {
    it("returns suggestions for a single profile", () => {
      const result = getSuggestedIntegrations(["fullstack"]);
      expect(result).toContain("github");
      expect(result).toContain("vercel");
      expect(result).toContain("stripe");
    });

    it("merges suggestions from multiple profiles without duplicates", () => {
      const result = getSuggestedIntegrations(["fullstack", "seo"]);
      // Both have overlapping and unique integrations
      expect(result).toContain("github"); // from fullstack
      expect(result).toContain("google-search-console"); // from seo
      // No duplicates
      const unique = new Set(result);
      expect(unique.size).toBe(result.length);
    });

    it("returns empty array for empty input", () => {
      expect(getSuggestedIntegrations([])).toEqual([]);
    });

    it("returns empty array for unknown profile", () => {
      expect(getSuggestedIntegrations(["nonexistent" as never])).toEqual([]);
    });
  });

  describe("getSuggestedBlueprints", () => {
    it("returns blueprint suggestions for a profile with blueprints", () => {
      const result = getSuggestedBlueprints(["fullstack"]);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("indie-revenue-dashboard");
    });

    it("merges blueprint suggestions from multiple profiles", () => {
      const result = getSuggestedBlueprints(["fullstack", "opensource"]);
      expect(result).toContain("indie-revenue-dashboard"); // from fullstack
      expect(result).toContain("oss-command-center"); // from opensource
      const unique = new Set(result);
      expect(unique.size).toBe(result.length);
    });

    it("returns empty array for profiles without blueprints", () => {
      expect(getSuggestedBlueprints([])).toEqual([]);
    });
  });

  describe("snapshots", () => {
    it("PROFILE_GROUPS structure matches snapshot", () => {
      const structure = PROFILE_GROUPS.map((g) => ({
        label: g.label,
        profileIds: g.profiles.map((p) => p.id),
      }));
      expect(structure).toMatchInlineSnapshot(`
        [
          {
            "label": "Development",
            "profileIds": [
              "fullstack",
              "frontend",
              "backend",
              "mobile",
              "devops",
            ],
          },
          {
            "label": "Product & Business",
            "profileIds": [
              "indie",
              "team-lead",
              "opensource",
            ],
          },
          {
            "label": "Growth & Marketing",
            "profileIds": [
              "seo",
              "marketing",
              "content-creator",
              "data",
            ],
          },
        ]
      `);
    });

    it("fullstack suggested integrations match snapshot", () => {
      expect(getSuggestedIntegrations(["fullstack"])).toMatchInlineSnapshot(`
        [
          "github",
          "vercel",
          "stripe",
          "sentry",
          "openpanel",
        ]
      `);
    });
  });
});
