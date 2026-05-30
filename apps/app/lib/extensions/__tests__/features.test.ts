import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock getWebEnv before importing features (so FEATURE_REGISTRY reads our mocked values)
const mockGetWebEnv = vi.fn<(name: string) => string | undefined>();
vi.mock("@/lib/env", () => ({
  getWebEnv: (name: string) => mockGetWebEnv(name),
}));

import {
  type FeatureId,
  type FeaturePreferences,
  getDisabledSettingsSections,
  getDisabledToolNames,
  isFeatureEnabled,
  isFeaturePlanLocked,
  listFeatures,
  listUserFeatures,
  resolveFeatureEnabled,
} from "../runtime/features";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set an env var value for a specific feature's envKey. */
function setEnv(feature: FeatureId, value: string | undefined): void {
  // Map feature IDs to their env keys (matching FEATURE_REGISTRY)
  const envKeys: Record<FeatureId, string> = {
    assistant: "NEXT_PUBLIC_FEATURE_ASSISTANT",
    skills: "NEXT_PUBLIC_FEATURE_SKILLS",
    workflows: "NEXT_PUBLIC_FEATURE_WORKFLOWS",
    briefing: "NEXT_PUBLIC_FEATURE_BRIEFING",
    notifications: "NEXT_PUBLIC_FEATURE_NOTIFICATIONS",
    mcpServers: "NEXT_PUBLIC_FEATURE_MCP_SERVERS",
    memory: "NEXT_PUBLIC_FEATURE_MEMORY",
    onboarding: "NEXT_PUBLIC_FEATURE_ONBOARDING",
    demoMode: "NEXT_PUBLIC_FEATURE_DEMO_MODE",
  };
  const key = envKeys[feature];
  mockGetWebEnv.mockImplementation((name: string) => (name === key ? value : undefined));
}

/** Set all env vars to undefined (all features use defaults). */
function clearAllEnv(): void {
  mockGetWebEnv.mockReturnValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("features", () => {
  beforeEach(() => {
    clearAllEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // isFeatureEnabled (env gate only)
  // -------------------------------------------------------------------------

  describe("isFeatureEnabled", () => {
    it("returns true by default when env var is unset", () => {
      expect(isFeatureEnabled("assistant")).toBe(true);
      expect(isFeatureEnabled("workflows")).toBe(true);
      expect(isFeatureEnabled("onboarding")).toBe(true);
    });

    it('returns false when env var is "0"', () => {
      setEnv("assistant", "0");
      expect(isFeatureEnabled("assistant")).toBe(false);
    });

    it('returns false when env var is "false"', () => {
      setEnv("workflows", "false");
      expect(isFeatureEnabled("workflows")).toBe(false);
    });

    it('returns true when env var is "1"', () => {
      setEnv("skills", "1");
      expect(isFeatureEnabled("skills")).toBe(true);
    });

    it('returns true when env var is "true"', () => {
      setEnv("briefing", "true");
      expect(isFeatureEnabled("briefing")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // resolveFeatureEnabled (env + user preferences)
  // -------------------------------------------------------------------------

  describe("resolveFeatureEnabled", () => {
    it("returns false when env disables feature regardless of user pref (hard override)", () => {
      setEnv("assistant", "false");
      expect(resolveFeatureEnabled("assistant", { assistant: true })).toBe(false);
    });

    it("system tier: ignores user preferences entirely", () => {
      // onboarding is system tier — user pref should have no effect
      expect(resolveFeatureEnabled("onboarding", { onboarding: false } as FeaturePreferences)).toBe(
        true
      );
      expect(resolveFeatureEnabled("demoMode", { demoMode: false } as FeaturePreferences)).toBe(
        true
      );
    });

    it("user tier: returns user preference when env is enabled", () => {
      expect(resolveFeatureEnabled("assistant", { assistant: false })).toBe(false);
      expect(resolveFeatureEnabled("assistant", { assistant: true })).toBe(true);
    });

    it("user tier: falls back to defaultEnabled when no user preference", () => {
      // All features default to true (when plan allows)
      expect(resolveFeatureEnabled("assistant", {})).toBe(true); // free plan, free feature
      expect(resolveFeatureEnabled("workflows", {}, "pro")).toBe(true); // pro plan, pro feature
      expect(resolveFeatureEnabled("skills", undefined, "pro")).toBe(true); // pro plan, pro feature
    });

    it("user tier: user pref=false disables even when env is on", () => {
      expect(resolveFeatureEnabled("notifications", { notifications: false })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Plan-based resolution
  // -------------------------------------------------------------------------

  describe("plan-based resolution", () => {
    it("pro features are disabled for free plan users", () => {
      expect(resolveFeatureEnabled("workflows", {}, "free")).toBe(false);
      expect(resolveFeatureEnabled("skills", {}, "free")).toBe(false);
    });

    it("pro features are enabled for pro plan users", () => {
      expect(resolveFeatureEnabled("workflows", {}, "pro")).toBe(true);
      expect(resolveFeatureEnabled("skills", {}, "pro")).toBe(true);
    });

    it("enterprise plan includes all pro features", () => {
      expect(resolveFeatureEnabled("workflows", {}, "enterprise")).toBe(true);
      expect(resolveFeatureEnabled("skills", {}, "enterprise")).toBe(true);
    });

    it("free features remain available on free plan", () => {
      expect(resolveFeatureEnabled("assistant", {}, "free")).toBe(true);
      expect(resolveFeatureEnabled("briefing", {}, "free")).toBe(true);
      expect(resolveFeatureEnabled("notifications", {}, "free")).toBe(true);
      expect(resolveFeatureEnabled("memory", {}, "free")).toBe(true);
      expect(resolveFeatureEnabled("mcpServers", {}, "free")).toBe(true);
    });

    it("env override still takes precedence over plan", () => {
      setEnv("workflows", "false");
      expect(resolveFeatureEnabled("workflows", {}, "pro")).toBe(false);
    });

    it("user pref still works within plan", () => {
      // Pro user can disable a pro feature via preference
      expect(resolveFeatureEnabled("workflows", { workflows: false }, "pro")).toBe(false);
    });

    it("user pref cannot override plan lock", () => {
      // Free user cannot enable a pro feature via preference
      expect(resolveFeatureEnabled("workflows", { workflows: true }, "free")).toBe(false);
    });

    it("defaults to free plan when no plan specified", () => {
      // workflows is pro — should be disabled with default (free) plan
      expect(resolveFeatureEnabled("workflows")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isFeaturePlanLocked
  // -------------------------------------------------------------------------

  describe("isFeaturePlanLocked", () => {
    it("returns true for pro features on free plan", () => {
      expect(isFeaturePlanLocked("workflows", "free")).toBe(true);
      expect(isFeaturePlanLocked("skills", "free")).toBe(true);
    });

    it("returns false for pro features on pro plan", () => {
      expect(isFeaturePlanLocked("workflows", "pro")).toBe(false);
    });

    it("returns false for free features on free plan", () => {
      expect(isFeaturePlanLocked("assistant", "free")).toBe(false);
    });

    it("returns false when feature is env-disabled (different state)", () => {
      setEnv("workflows", "false");
      expect(isFeaturePlanLocked("workflows", "free")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // listFeatures / listUserFeatures
  // -------------------------------------------------------------------------

  describe("listFeatures", () => {
    it("returns all 9 registered features", () => {
      const features = listFeatures();
      expect(features).toHaveLength(9);
    });

    it("includes tier information", () => {
      const features = listFeatures();
      const system = features.filter((f) => f.tier === "system");
      const user = features.filter((f) => f.tier === "user");
      expect(system).toHaveLength(2); // onboarding, demoMode
      expect(user).toHaveLength(7);
    });

    it("includes plan information", () => {
      const features = listFeatures(undefined, "enterprise");
      const workflows = features.find((f) => f.id === "workflows");
      expect(workflows?.plan).toBe("pro");
      const assistant = features.find((f) => f.id === "assistant");
      expect(assistant?.plan).toBe("free");
    });

    it("marks plan-locked features", () => {
      const features = listFeatures(undefined, "free");
      const workflows = features.find((f) => f.id === "workflows");
      expect(workflows?.planLocked).toBe(true);
      expect(workflows?.effectiveEnabled).toBe(false);
      const assistant = features.find((f) => f.id === "assistant");
      expect(assistant?.planLocked).toBe(false);
      expect(assistant?.effectiveEnabled).toBe(true);
    });

    it("respects user preferences in effectiveEnabled", () => {
      const features = listFeatures({ assistant: false }, "enterprise");
      const assistant = features.find((f) => f.id === "assistant");
      expect(assistant?.envEnabled).toBe(true);
      expect(assistant?.effectiveEnabled).toBe(false);
      expect(assistant?.userPref).toBe(false);
    });

    it("system features ignore user preferences", () => {
      const features = listFeatures({ onboarding: false } as FeaturePreferences, "enterprise");
      const onboarding = features.find((f) => f.id === "onboarding");
      expect(onboarding?.effectiveEnabled).toBe(true);
    });
  });

  describe("listUserFeatures", () => {
    it("returns only user-tier features", () => {
      const features = listUserFeatures();
      expect(features.every((f) => f.tier === "user")).toBe(true);
      expect(features).toHaveLength(7);
    });

    it("excludes system-tier features", () => {
      const ids = listUserFeatures().map((f) => f.id);
      expect(ids).not.toContain("onboarding");
      expect(ids).not.toContain("demoMode");
    });
  });

  // -------------------------------------------------------------------------
  // getDisabledSettingsSections
  // -------------------------------------------------------------------------

  describe("getDisabledSettingsSections", () => {
    it("returns empty array when all features enabled (enterprise plan)", () => {
      expect(getDisabledSettingsSections(undefined, "enterprise")).toEqual([]);
    });

    it("includes sections for plan-locked features on free plan", () => {
      const sections = getDisabledSettingsSections(undefined, "free");
      expect(sections).toContain("workflows"); // pro feature
      expect(sections).not.toContain("mcp-servers"); // free feature
    });

    it("includes section when env disables the feature", () => {
      setEnv("assistant", "false");
      const sections = getDisabledSettingsSections(undefined, "enterprise");
      expect(sections).toContain("ai");
    });

    it("includes section when user preference disables the feature", () => {
      const sections = getDisabledSettingsSections({ workflows: false }, "pro");
      expect(sections).toContain("workflows");
    });

    it("includes multiple sections when multiple features disabled", () => {
      const sections = getDisabledSettingsSections(
        {
          notifications: false,
          mcpServers: false,
        },
        "free"
      );
      expect(sections).toContain("workflows"); // plan-locked
      expect(sections).toContain("notifications"); // user-disabled
      expect(sections).toContain("mcp-servers"); // user-disabled
    });

    it("env override takes precedence over plan", () => {
      setEnv("workflows", "0");
      const sections = getDisabledSettingsSections({ workflows: true }, "pro");
      expect(sections).toContain("workflows");
    });
  });

  // -------------------------------------------------------------------------
  // getDisabledToolNames
  // -------------------------------------------------------------------------

  describe("getDisabledToolNames", () => {
    it("returns empty set when all features enabled (enterprise plan)", () => {
      expect(getDisabledToolNames(undefined, "enterprise").size).toBe(0);
    });

    it("includes tools for plan-locked features on free plan", () => {
      const tools = getDisabledToolNames(undefined, "free");
      // Workflows (pro) tools should be disabled
      expect(tools.has("create_workflow")).toBe(true);
      expect(tools.has("list_workflows")).toBe(true);
      // Skills (pro) tools should be disabled
      expect(tools.has("update_skill")).toBe(true);
      // Memory (free) tools should NOT be disabled
      expect(tools.has("remember")).toBe(false);
    });

    it("includes tools when feature is disabled via env", () => {
      setEnv("skills", "false");
      const tools = getDisabledToolNames(undefined, "pro");
      expect(tools.has("update_skill")).toBe(true);
    });

    it("includes tools when feature is disabled via user pref", () => {
      const tools = getDisabledToolNames({ memory: false }, "pro");
      expect(tools.has("remember")).toBe(true);
      expect(tools.has("recall")).toBe(true);
      expect(tools.has("forget")).toBe(true);
      expect(tools.has("list_memories")).toBe(true);
      expect(tools.has("save_artifact")).toBe(true);
      expect(tools.has("list_artifacts")).toBe(true);
      expect(tools.has("get_artifact")).toBe(true);
    });

    it("does not include tools from enabled features", () => {
      const tools = getDisabledToolNames({ skills: false }, "pro");
      expect(tools.has("update_skill")).toBe(true);
      // Memory tools should NOT be disabled (pro plan, no user pref)
      expect(tools.has("remember")).toBe(false);
    });
  });
});
