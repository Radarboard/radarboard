import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FEATURE_REGISTRY, registerFeature } from "./registry";
import {
  getDisabledSettingsSections,
  getDisabledToolNames,
  isFeaturePlanLocked,
  listFeatures,
  listUserFeatures,
  resolveFeatureEnabled,
} from "./resolution";
import type { FeatureDescriptor, FeaturePreferences } from "./types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const FREE_FEATURE: FeatureDescriptor = {
  id: "dashboard",
  envKey: "NEXT_PUBLIC_FEATURE_DASHBOARD",
  label: "Dashboard",
  description: "Core dashboard",
  defaultEnabled: true,
  tier: "user",
  plan: "free",
  category: "core",
  settingsSections: ["dashboard-settings"],
  gatedTools: ["dashboard-tool"],
};

const PRO_FEATURE: FeatureDescriptor = {
  id: "workflows",
  envKey: "NEXT_PUBLIC_FEATURE_WORKFLOWS",
  label: "Workflows",
  description: "Automated workflows",
  defaultEnabled: true,
  tier: "user",
  plan: "pro",
  category: "automation",
  settingsSections: ["workflows-settings"],
  gatedTools: ["run-workflow", "list-workflows"],
};

const ENTERPRISE_FEATURE: FeatureDescriptor = {
  id: "sso",
  envKey: "NEXT_PUBLIC_FEATURE_SSO",
  label: "SSO",
  description: "Single sign-on",
  defaultEnabled: true,
  tier: "user",
  plan: "enterprise",
  category: "security",
  settingsSections: ["sso-settings"],
  gatedTools: ["sso-configure"],
};

const SYSTEM_FEATURE: FeatureDescriptor = {
  id: "debug",
  envKey: "NEXT_PUBLIC_FEATURE_DEBUG",
  label: "Debug Mode",
  description: "Debug mode for developers",
  defaultEnabled: false,
  tier: "system",
  plan: "free",
  category: "developer",
};

const DEFAULT_DISABLED_FEATURE: FeatureDescriptor = {
  id: "experimental",
  envKey: "NEXT_PUBLIC_FEATURE_EXPERIMENTAL",
  label: "Experimental",
  description: "Experimental features",
  defaultEnabled: false,
  tier: "user",
  plan: "free",
  category: "general",
  settingsSections: ["experimental-settings"],
  gatedTools: ["experimental-tool"],
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  registerFeature(FREE_FEATURE);
  registerFeature(PRO_FEATURE);
  registerFeature(ENTERPRISE_FEATURE);
  registerFeature(SYSTEM_FEATURE);
  registerFeature(DEFAULT_DISABLED_FEATURE);
});

afterEach(() => {
  FEATURE_REGISTRY.clear();
});

// ---------------------------------------------------------------------------
// resolveFeatureEnabled
// ---------------------------------------------------------------------------

describe("resolveFeatureEnabled", () => {
  it("returns false for an unknown feature", () => {
    expect(resolveFeatureEnabled("nonexistent", true, {}, "pro")).toBe(false);
  });

  it("returns false when env gate is off regardless of plan", () => {
    expect(resolveFeatureEnabled("dashboard", false, {}, "enterprise")).toBe(false);
  });

  describe("plan-based access control", () => {
    it("free user can access free features", () => {
      expect(resolveFeatureEnabled("dashboard", true, {}, "free")).toBe(true);
    });

    it("free user cannot access pro features", () => {
      expect(resolveFeatureEnabled("workflows", true, {}, "free")).toBe(false);
    });

    it("free user cannot access enterprise features", () => {
      expect(resolveFeatureEnabled("sso", true, {}, "free")).toBe(false);
    });

    it("pro user can access free features", () => {
      expect(resolveFeatureEnabled("dashboard", true, {}, "pro")).toBe(true);
    });

    it("pro user can access pro features", () => {
      expect(resolveFeatureEnabled("workflows", true, {}, "pro")).toBe(true);
    });

    it("pro user cannot access enterprise features", () => {
      expect(resolveFeatureEnabled("sso", true, {}, "pro")).toBe(false);
    });

    it("enterprise user can access all tiers", () => {
      expect(resolveFeatureEnabled("dashboard", true, {}, "enterprise")).toBe(true);
      expect(resolveFeatureEnabled("workflows", true, {}, "enterprise")).toBe(true);
      expect(resolveFeatureEnabled("sso", true, {}, "enterprise")).toBe(true);
    });
  });

  describe("user preferences", () => {
    it("respects user preference to disable a free feature", () => {
      const prefs: FeaturePreferences = { dashboard: false };
      expect(resolveFeatureEnabled("dashboard", true, prefs, "free")).toBe(false);
    });

    it("respects user preference to enable a default-disabled feature", () => {
      const prefs: FeaturePreferences = { experimental: true };
      expect(resolveFeatureEnabled("experimental", true, prefs, "free")).toBe(true);
    });

    it("user preference cannot override plan lock", () => {
      const prefs: FeaturePreferences = { workflows: true };
      expect(resolveFeatureEnabled("workflows", true, prefs, "free")).toBe(false);
    });

    it("falls back to defaultEnabled when no user pref is set", () => {
      expect(resolveFeatureEnabled("dashboard", true, {}, "free")).toBe(true);
      expect(resolveFeatureEnabled("experimental", true, {}, "free")).toBe(false);
    });
  });

  describe("system tier", () => {
    it("system feature ignores user preferences", () => {
      const prefs: FeaturePreferences = { debug: true };
      // system tier: env on → always true (ignores user prefs)
      expect(resolveFeatureEnabled("debug", true, prefs, "free")).toBe(true);
    });

    it("system feature disabled when env gate is off", () => {
      expect(resolveFeatureEnabled("debug", false, {}, "free")).toBe(false);
    });
  });

  it("defaults userPlan to free when omitted", () => {
    expect(resolveFeatureEnabled("workflows", true)).toBe(false);
    expect(resolveFeatureEnabled("dashboard", true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isFeaturePlanLocked
// ---------------------------------------------------------------------------

describe("isFeaturePlanLocked", () => {
  it("returns false for unknown features", () => {
    expect(isFeaturePlanLocked("nonexistent", true, "free")).toBe(false);
  });

  it("returns false when env gate is off (different state than plan-locked)", () => {
    expect(isFeaturePlanLocked("workflows", false, "free")).toBe(false);
  });

  it("free user is plan-locked on pro features", () => {
    expect(isFeaturePlanLocked("workflows", true, "free")).toBe(true);
  });

  it("free user is plan-locked on enterprise features", () => {
    expect(isFeaturePlanLocked("sso", true, "free")).toBe(true);
  });

  it("pro user is not plan-locked on pro features", () => {
    expect(isFeaturePlanLocked("workflows", true, "pro")).toBe(false);
  });

  it("pro user is plan-locked on enterprise features", () => {
    expect(isFeaturePlanLocked("sso", true, "pro")).toBe(true);
  });

  it("enterprise user is never plan-locked", () => {
    expect(isFeaturePlanLocked("dashboard", true, "enterprise")).toBe(false);
    expect(isFeaturePlanLocked("workflows", true, "enterprise")).toBe(false);
    expect(isFeaturePlanLocked("sso", true, "enterprise")).toBe(false);
  });

  it("free features are never plan-locked", () => {
    expect(isFeaturePlanLocked("dashboard", true, "free")).toBe(false);
  });

  it("defaults userPlan to free when omitted", () => {
    expect(isFeaturePlanLocked("workflows", true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listFeatures / listUserFeatures
// ---------------------------------------------------------------------------

describe("listFeatures", () => {
  it("returns all registered features", () => {
    const envGates: Record<string, boolean> = {
      dashboard: true,
      workflows: true,
      sso: true,
      debug: true,
      experimental: true,
    };
    const features = listFeatures(envGates, {}, "free");
    expect(features).toHaveLength(5);
  });

  it("includes plan, category, and planLocked info", () => {
    const envGates: Record<string, boolean> = {
      dashboard: true,
      workflows: true,
    };
    const features = listFeatures(envGates, {}, "free");

    const dashboard = features.find((f) => f.id === "dashboard");
    expect(dashboard).toBeDefined();
    expect(dashboard?.plan).toBe("free");
    expect(dashboard?.category).toBe("core");
    expect(dashboard?.planLocked).toBe(false);
    expect(dashboard?.effectiveEnabled).toBe(true);

    const workflows = features.find((f) => f.id === "workflows");
    expect(workflows).toBeDefined();
    expect(workflows?.plan).toBe("pro");
    expect(workflows?.category).toBe("automation");
    expect(workflows?.planLocked).toBe(true);
    expect(workflows?.effectiveEnabled).toBe(false);
  });

  it("marks pro features as unlocked for pro users", () => {
    const envGates: Record<string, boolean> = { workflows: true };
    const features = listFeatures(envGates, {}, "pro");
    const workflows = features.find((f) => f.id === "workflows");
    expect(workflows?.planLocked).toBe(false);
    expect(workflows?.effectiveEnabled).toBe(true);
  });

  it("defaults envEnabled from defaultEnabled when feature not in envGates", () => {
    const features = listFeatures({}, {}, "free");
    const dashboard = features.find((f) => f.id === "dashboard");
    expect(dashboard?.envEnabled).toBe(true); // defaultEnabled is true

    const experimental = features.find((f) => f.id === "experimental");
    expect(experimental?.envEnabled).toBe(false); // defaultEnabled is false
  });

  it("includes userPref value when provided", () => {
    const prefs: FeaturePreferences = { dashboard: false };
    const features = listFeatures({ dashboard: true }, prefs, "free");
    const dashboard = features.find((f) => f.id === "dashboard");
    expect(dashboard?.userPref).toBe(false);
    expect(dashboard?.effectiveEnabled).toBe(false);
  });
});

describe("listUserFeatures", () => {
  it("excludes system-tier features", () => {
    const envGates: Record<string, boolean> = {
      dashboard: true,
      workflows: true,
      sso: true,
      debug: true,
      experimental: true,
    };
    const features = listUserFeatures(envGates, {}, "free");
    const ids = features.map((f) => f.id);
    expect(ids).not.toContain("debug");
    expect(features).toHaveLength(4);
  });

  it("includes only user-tier features with correct plan info", () => {
    const envGates: Record<string, boolean> = { workflows: true, dashboard: true };
    const features = listUserFeatures(envGates, {}, "free");
    for (const f of features) {
      expect(f.tier).toBe("user");
    }
  });
});

// ---------------------------------------------------------------------------
// getDisabledSettingsSections
// ---------------------------------------------------------------------------

describe("getDisabledSettingsSections", () => {
  it("returns sections of disabled features", () => {
    const envGates: Record<string, boolean> = {
      dashboard: true,
      workflows: true,
      sso: true,
    };
    // Free user: workflows (pro) and sso (enterprise) are disabled
    const sections = getDisabledSettingsSections(envGates, {}, "free");
    expect(sections).toContain("workflows-settings");
    expect(sections).toContain("sso-settings");
    expect(sections).not.toContain("dashboard-settings");
  });

  it("returns sections for env-disabled features", () => {
    const envGates: Record<string, boolean> = { dashboard: false };
    const sections = getDisabledSettingsSections(envGates, {}, "free");
    expect(sections).toContain("dashboard-settings");
  });

  it("returns sections for user-disabled features", () => {
    const prefs: FeaturePreferences = { dashboard: false };
    const sections = getDisabledSettingsSections({ dashboard: true }, prefs, "free");
    expect(sections).toContain("dashboard-settings");
  });

  it("returns empty array when all features are enabled", () => {
    const envGates: Record<string, boolean> = {
      dashboard: true,
      workflows: true,
      sso: true,
      debug: true,
      experimental: true,
    };
    const prefs: FeaturePreferences = { experimental: true };
    const sections = getDisabledSettingsSections(envGates, prefs, "enterprise");
    // debug has no settingsSections, experimental is enabled by pref
    expect(sections).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDisabledToolNames
// ---------------------------------------------------------------------------

describe("getDisabledToolNames", () => {
  it("returns tools of plan-locked features", () => {
    const envGates: Record<string, boolean> = {
      dashboard: true,
      workflows: true,
      sso: true,
    };
    const tools = getDisabledToolNames(envGates, {}, "free");
    expect(tools.has("run-workflow")).toBe(true);
    expect(tools.has("list-workflows")).toBe(true);
    expect(tools.has("sso-configure")).toBe(true);
    expect(tools.has("dashboard-tool")).toBe(false);
  });

  it("returns tools of env-disabled features", () => {
    const tools = getDisabledToolNames({ dashboard: false }, {}, "free");
    expect(tools.has("dashboard-tool")).toBe(true);
  });

  it("returns tools of default-disabled features", () => {
    const tools = getDisabledToolNames({ experimental: true }, {}, "free");
    // experimental is defaultEnabled: false, no user pref
    expect(tools.has("experimental-tool")).toBe(true);
  });

  it("does not include tools when feature is enabled", () => {
    const prefs: FeaturePreferences = { experimental: true };
    const tools = getDisabledToolNames({ experimental: true }, prefs, "free");
    expect(tools.has("experimental-tool")).toBe(false);
  });

  it("returns empty set when all features enabled for enterprise", () => {
    const envGates: Record<string, boolean> = {
      dashboard: true,
      workflows: true,
      sso: true,
      debug: true,
      experimental: true,
    };
    const prefs: FeaturePreferences = { experimental: true };
    const tools = getDisabledToolNames(envGates, prefs, "enterprise");
    expect(tools.size).toBe(0);
  });
});
