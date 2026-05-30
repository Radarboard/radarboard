/**
 * Feature resolution — pure functions that combine env gates with user
 * preferences to determine effective feature state.
 *
 * These functions are intentionally pure (no env access, no side effects).
 * The calling app provides env gate values via `envGates` parameter.
 */

import { FEATURE_REGISTRY } from "./registry";
import { type FeatureInfo, type FeaturePreferences, PLAN_RANK, type PlanTier } from "./types";

// ---------------------------------------------------------------------------
// Core resolution
// ---------------------------------------------------------------------------

/**
 * Resolve whether a feature is effectively enabled.
 *
 * Resolution order:
 *   1. Env gate (hard override — if false, always disabled)
 *   2. Plan check — if feature requires a higher plan, disabled
 *   3. Tier check — system tier ignores user prefs
 *   4. User preference (user tier only)
 *   5. Feature defaultEnabled
 *
 * @param featureId - Feature identifier
 * @param envEnabled - Whether the env var allows this feature
 * @param userPrefs - Optional user-stored preferences
 * @param userPlan - The user's current subscription plan (defaults to "free")
 */
export function resolveFeatureEnabled(
  featureId: string,
  envEnabled: boolean,
  userPrefs?: FeaturePreferences,
  userPlan: PlanTier = "free"
): boolean {
  const descriptor = FEATURE_REGISTRY.get(featureId);
  if (!descriptor) return false;

  // Env gate is a hard override
  if (!envEnabled) return false;

  // Plan check: feature requires a plan the user doesn't have
  const requiredPlan = descriptor.plan ?? "free";
  if (PLAN_RANK[requiredPlan] > PLAN_RANK[userPlan]) return false;

  // System tier: env is sole authority
  if (descriptor.tier === "system") return true;

  // User tier: check user preference, fallback to default
  if (userPrefs && featureId in userPrefs) {
    return userPrefs[featureId] ?? descriptor.defaultEnabled;
  }

  return descriptor.defaultEnabled;
}

/**
 * Check if a feature is locked behind a higher plan than the user has.
 */
export function isFeaturePlanLocked(
  featureId: string,
  envEnabled: boolean,
  userPlan: PlanTier = "free"
): boolean {
  const descriptor = FEATURE_REGISTRY.get(featureId);
  if (!descriptor) return false;
  if (!envEnabled) return false; // env-disabled is a different state
  const requiredPlan = descriptor.plan ?? "free";
  return PLAN_RANK[requiredPlan] > PLAN_RANK[userPlan];
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

/**
 * List all registered features with their current state.
 *
 * @param envGates - Map of featureId → env-var-enabled boolean
 * @param userPrefs - Optional user-stored preferences
 * @param userPlan - The user's current subscription plan (defaults to "free")
 */
export function listFeatures(
  envGates: Record<string, boolean>,
  userPrefs?: FeaturePreferences,
  userPlan: PlanTier = "free"
): FeatureInfo[] {
  return getAllFeaturesAsInfo(envGates, userPrefs, userPlan);
}

/**
 * List only user-tier features (for the Features settings panel).
 */
export function listUserFeatures(
  envGates: Record<string, boolean>,
  userPrefs?: FeaturePreferences,
  userPlan: PlanTier = "free"
): FeatureInfo[] {
  return getAllFeaturesAsInfo(envGates, userPrefs, userPlan).filter((f) => f.tier === "user");
}

function getAllFeaturesAsInfo(
  envGates: Record<string, boolean>,
  userPrefs?: FeaturePreferences,
  userPlan: PlanTier = "free"
): FeatureInfo[] {
  const features: FeatureInfo[] = [];
  for (const descriptor of FEATURE_REGISTRY.values()) {
    const envEnabled = envGates[descriptor.id] ?? descriptor.defaultEnabled;
    features.push({
      id: descriptor.id,
      label: descriptor.label,
      description: descriptor.description,
      tier: descriptor.tier,
      plan: descriptor.plan ?? "free",
      category: descriptor.category ?? "general",
      envEnabled,
      userPref: userPrefs?.[descriptor.id],
      effectiveEnabled: resolveFeatureEnabled(descriptor.id, envEnabled, userPrefs, userPlan),
      planLocked: isFeaturePlanLocked(descriptor.id, envEnabled, userPlan),
    });
  }
  return features;
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/**
 * Collect settings section IDs that should be hidden because their
 * parent feature is disabled.
 */
export function getDisabledSettingsSections(
  envGates: Record<string, boolean>,
  userPrefs?: FeaturePreferences,
  userPlan: PlanTier = "free"
): string[] {
  const disabled: string[] = [];
  for (const descriptor of FEATURE_REGISTRY.values()) {
    const envEnabled = envGates[descriptor.id] ?? descriptor.defaultEnabled;
    if (
      !resolveFeatureEnabled(descriptor.id, envEnabled, userPrefs, userPlan) &&
      descriptor.settingsSections
    ) {
      disabled.push(...descriptor.settingsSections);
    }
  }
  return disabled;
}

/**
 * Collect AI tool names that should be excluded because their
 * parent feature is disabled.
 */
export function getDisabledToolNames(
  envGates: Record<string, boolean>,
  userPrefs?: FeaturePreferences,
  userPlan: PlanTier = "free"
): Set<string> {
  const disabled = new Set<string>();
  for (const descriptor of FEATURE_REGISTRY.values()) {
    const envEnabled = envGates[descriptor.id] ?? descriptor.defaultEnabled;
    if (
      !resolveFeatureEnabled(descriptor.id, envEnabled, userPrefs, userPlan) &&
      descriptor.gatedTools
    ) {
      for (const tool of descriptor.gatedTools) {
        disabled.add(tool);
      }
    }
  }
  return disabled;
}
