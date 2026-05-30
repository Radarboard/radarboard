/**
 * Smoke tests: verify that disabling each feature doesn't break the system.
 *
 * For each user-togglable feature, these tests verify:
 * 1. The correct settings sections are hidden
 * 2. The correct AI tools are excluded
 * 3. Other features remain unaffected
 *
 * These tests do NOT test API routes (that requires route-level mocking).
 * They test the derived helpers that all consumers depend on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetWebEnv = vi.fn<(name: string) => string | undefined>();
vi.mock("@/lib/env", () => ({
  getWebEnv: (name: string) => mockGetWebEnv(name),
}));

import {
  type FeatureId,
  type FeaturePreferences,
  getDisabledSettingsSections,
  getDisabledToolNames,
  listFeatures,
  listUserFeatures,
  resolveFeatureEnabled,
} from "../runtime/features";

// ---------------------------------------------------------------------------
// All user-togglable features and what they gate
// ---------------------------------------------------------------------------

const USER_FEATURES: {
  id: FeatureId;
  sections: string[];
  tools: string[];
}[] = [
  { id: "assistant", sections: ["ai"], tools: ["update_llm_config"] },
  { id: "skills", sections: [], tools: ["update_skill"] },
  { id: "workflows", sections: ["workflows"], tools: [] },
  { id: "briefing", sections: [], tools: [] },
  { id: "notifications", sections: ["notifications"], tools: [] },
  { id: "mcpServers", sections: ["mcp-servers"], tools: [] },
  {
    id: "memory",
    sections: [],
    tools: [
      "remember",
      "recall",
      "forget",
      "list_memories",
      "save_artifact",
      "list_artifacts",
      "get_artifact",
    ],
  },
];

describe("feature-off smoke tests", () => {
  beforeEach(() => {
    mockGetWebEnv.mockReturnValue(undefined); // All env vars unset = all enabled
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Per-feature isolation: disabling ONE feature doesn't affect others
  // -------------------------------------------------------------------------

  for (const feature of USER_FEATURES) {
    describe(`when "${feature.id}" is disabled via user preference`, () => {
      const prefs: FeaturePreferences = { [feature.id]: false };

      it("is effectively disabled", () => {
        expect(resolveFeatureEnabled(feature.id, prefs)).toBe(false);
      });

      it("all other user features remain enabled", () => {
        for (const other of USER_FEATURES) {
          if (other.id !== feature.id) {
            expect(resolveFeatureEnabled(other.id, prefs)).toBe(resolveFeatureEnabled(other.id));
          }
        }
      });

      it("system features remain unaffected", () => {
        expect(resolveFeatureEnabled("onboarding", prefs)).toBe(true);
        expect(resolveFeatureEnabled("demoMode", prefs)).toBe(true);
      });

      if (feature.sections.length > 0) {
        it(`hides settings sections: ${feature.sections.join(", ")}`, () => {
          const disabled = getDisabledSettingsSections(prefs);
          for (const section of feature.sections) {
            expect(disabled).toContain(section);
          }
        });

        it("does not hide sections from other features", () => {
          const disabled = getDisabledSettingsSections(prefs);
          for (const other of USER_FEATURES) {
            if (other.id !== feature.id) {
              for (const section of other.sections) {
                const baseline = getDisabledSettingsSections();
                expect(disabled.includes(section)).toBe(baseline.includes(section));
              }
            }
          }
        });
      }

      if (feature.tools.length > 0) {
        it(`excludes AI tools: ${feature.tools.join(", ")}`, () => {
          const disabled = getDisabledToolNames(prefs);
          for (const tool of feature.tools) {
            expect(disabled.has(tool)).toBe(true);
          }
        });

        it("does not exclude tools from other features", () => {
          const disabled = getDisabledToolNames(prefs);
          const baseline = getDisabledToolNames();
          for (const other of USER_FEATURES) {
            if (other.id !== feature.id) {
              for (const tool of other.tools) {
                expect(disabled.has(tool)).toBe(baseline.has(tool));
              }
            }
          }
        });
      }
    });
  }

  // -------------------------------------------------------------------------
  // All features disabled at once: system still doesn't crash
  // -------------------------------------------------------------------------

  describe("when ALL user features are disabled", () => {
    const allOff: FeaturePreferences = {};
    for (const f of USER_FEATURES) {
      allOff[f.id] = false;
    }

    it("all user features are effectively disabled", () => {
      for (const f of USER_FEATURES) {
        expect(resolveFeatureEnabled(f.id, allOff)).toBe(false);
      }
    });

    it("system features remain enabled", () => {
      expect(resolveFeatureEnabled("onboarding", allOff)).toBe(true);
      expect(resolveFeatureEnabled("demoMode", allOff)).toBe(true);
    });

    it("all gated sections are disabled", () => {
      const disabled = getDisabledSettingsSections(allOff);
      expect(disabled).toContain("ai");
      expect(disabled).toContain("workflows");
      expect(disabled).toContain("notifications");
      expect(disabled).toContain("mcp-servers");
    });

    it("all gated tools are disabled", () => {
      const disabled = getDisabledToolNames(allOff);
      expect(disabled.has("update_llm_config")).toBe(true);
      expect(disabled.has("update_skill")).toBe(true);
      expect(disabled.has("remember")).toBe(true);
      expect(disabled.has("recall")).toBe(true);
    });

    it("listFeatures still returns all features (for debug panel)", () => {
      const features = listFeatures(allOff);
      expect(features).toHaveLength(9);
      // All user features should show effectiveEnabled=false
      for (const f of features) {
        if (f.tier === "user") {
          expect(f.effectiveEnabled).toBe(false);
        } else {
          expect(f.effectiveEnabled).toBe(true);
        }
      }
    });

    it("listUserFeatures still returns all user features (for settings panel)", () => {
      const features = listUserFeatures(allOff);
      expect(features).toHaveLength(7);
    });
  });

  // -------------------------------------------------------------------------
  // Hard override: env var disables even when user pref is true
  // -------------------------------------------------------------------------

  describe("env var hard override", () => {
    for (const feature of USER_FEATURES) {
      it(`"${feature.id}": env=false overrides user pref=true`, () => {
        // Set this feature's env var to "false"
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
        const key = envKeys[feature.id];
        mockGetWebEnv.mockImplementation((name: string) => (name === key ? "false" : undefined));

        expect(resolveFeatureEnabled(feature.id, { [feature.id]: true })).toBe(false);
      });
    }
  });
});
