/**
 * Core types for the feature flag system.
 *
 * Features are registered via descriptors and resolved at runtime
 * by combining env-var gates with optional user preferences.
 */

// ---------------------------------------------------------------------------
// Plan tiers — which subscription plan unlocks a feature
// ---------------------------------------------------------------------------

export type PlanTier = "free" | "pro" | "enterprise";

/** Numeric rank for plan comparison. Higher rank includes all lower tiers. */
export const PLAN_RANK: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

// ---------------------------------------------------------------------------
// Feature descriptor — what a feature declares about itself
// ---------------------------------------------------------------------------

export interface FeatureDescriptor {
  /** Unique identifier (e.g. "assistant", "workflows"). */
  id: string;
  /** Environment variable that controls this feature. */
  envKey: string;
  /** Human-readable label for settings/debug UI. */
  label: string;
  /** Short description shown in the Features settings panel. */
  description: string;
  /** Whether the feature is enabled by default when no env var or user pref is set. */
  defaultEnabled: boolean;
  /** "system" = maintainer-only (env var). "user" = user-togglable + env override. */
  tier: "system" | "user";
  /** Which subscription plan is required. Defaults to "free" if omitted. */
  plan?: PlanTier;
  /** Category for grouping in settings UI (e.g. "ai", "automation"). */
  category?: string;
  /** Settings sidebar section(s) hidden when this feature is disabled. */
  settingsSections?: string[];
  /** AI tool names that should be excluded when this feature is disabled. */
  gatedTools?: string[];
  /** Other feature IDs this feature depends on. If a dependency is disabled, this is too. */
  requires?: string[];
}

// ---------------------------------------------------------------------------
// User preferences — stored in DB, partial (missing = use default)
// ---------------------------------------------------------------------------

export type FeaturePreferences = Partial<Record<string, boolean>>;

// ---------------------------------------------------------------------------
// Feature info — returned by list functions for UI rendering
// ---------------------------------------------------------------------------

export interface FeatureInfo {
  id: string;
  label: string;
  description: string;
  tier: "system" | "user";
  plan: PlanTier;
  category: string;
  envEnabled: boolean;
  userPref: boolean | undefined;
  effectiveEnabled: boolean;
  /** True when the feature is disabled solely because the user's plan is too low. */
  planLocked: boolean;
}
