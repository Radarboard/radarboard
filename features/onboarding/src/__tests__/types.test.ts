import { describe, expect, it } from "vitest";
import { INITIAL_ONBOARDING_STATE, ONBOARDING_STEPS } from "../components/onboarding-wizard/types";

describe("onboarding types", () => {
  describe("ONBOARDING_STEPS", () => {
    it("has 7 steps", () => {
      expect(ONBOARDING_STEPS).toHaveLength(7);
    });

    it("steps are numbered 1 through 7", () => {
      expect(ONBOARDING_STEPS.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("first and last steps are not skippable", () => {
      expect(ONBOARDING_STEPS[0]?.skippable).toBe(false);
      expect(ONBOARDING_STEPS[6]?.skippable).toBe(false);
    });

    it("has expected step labels", () => {
      const labels = ONBOARDING_STEPS.map((s) => s.label);
      expect(labels).toEqual([
        "Welcome",
        "About You",
        "Database",
        "Integrations",
        "Plugins",
        "Layout",
        "Complete",
      ]);
    });

    it("does not include a Preferences step", () => {
      const labels = ONBOARDING_STEPS.map((s) => s.label);
      expect(labels).not.toContain("Preferences");
    });
  });

  describe("INITIAL_ONBOARDING_STATE", () => {
    it("starts with no profile selected", () => {
      expect(INITIAL_ONBOARDING_STATE.profile).toBeNull();
    });

    it("starts with demo mode off", () => {
      expect(INITIAL_ONBOARDING_STATE.demoMode).toBe(false);
    });

    it("starts with sqlite as default database provider", () => {
      expect(INITIAL_ONBOARDING_STATE.databaseProvider).toBe("sqlite");
    });

    it("starts with empty integrations", () => {
      expect(INITIAL_ONBOARDING_STATE.connectedIntegrations).toEqual([]);
    });

    it("starts with default plugins enabled", () => {
      expect(INITIAL_ONBOARDING_STATE.enabledPlugins.length).toBeGreaterThan(0);
      expect(INITIAL_ONBOARDING_STATE.enabledPlugins).toContain("tasks");
      expect(INITIAL_ONBOARDING_STATE.enabledPlugins).toContain("notes");
    });

    it("starts with no blueprint selected", () => {
      expect(INITIAL_ONBOARDING_STATE.blueprintId).toBeNull();
    });

    it("does not have currency, timezone, or theme fields", () => {
      const keys = Object.keys(INITIAL_ONBOARDING_STATE);
      expect(keys).not.toContain("currencies");
      expect(keys).not.toContain("timezone");
      expect(keys).not.toContain("theme");
    });
  });
});
