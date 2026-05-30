/* biome-ignore-all lint/performance/noBarrelFile: feature runtime intentionally re-exports a shared SDK constant for compatibility. */
/* biome-ignore-all lint/style/noProcessEnv: NEXT_PUBLIC plan must stay as a literal process.env access for Next client inlining. */
/**
 * Feature flags — web app wrapper around @radarboard/feature-sdk.
 *
 * This file:
 *   1. Registers all 9 features with the SDK registry
 *   2. Provides env-var reading via `isFeatureEnabled()` (web-specific)
 *   3. Re-exports SDK resolution functions with env gates pre-filled
 *
 * The SDK itself is pure (no env access) — this wrapper bridges
 * the gap by reading NEXT_PUBLIC_* env vars via `getWebEnv()`.
 */

import { registerFeature } from "@radarboard/feature-sdk/registry";
import {
  getDisabledSettingsSections as sdkGetDisabledSettingsSections,
  getDisabledToolNames as sdkGetDisabledToolNames,
  isFeaturePlanLocked as sdkIsFeaturePlanLocked,
  listFeatures as sdkListFeatures,
  listUserFeatures as sdkListUserFeatures,
  resolveFeatureEnabled as sdkResolveFeatureEnabled,
} from "@radarboard/feature-sdk/resolution";
import type {
  FeatureDescriptor,
  FeatureInfo,
  FeaturePreferences,
  PlanTier,
} from "@radarboard/feature-sdk/types";
import { getWebEnv } from "@/lib/env";
import { featureDescriptors, registerFeatures } from "./features-init";

// ---------------------------------------------------------------------------
// Re-export SDK types for backward compatibility
// ---------------------------------------------------------------------------

export type {
  FeatureDescriptor,
  FeatureInfo,
  FeaturePreferences,
  PlanTier,
} from "@radarboard/feature-sdk/types";
export { PLAN_RANK } from "@radarboard/feature-sdk/types";

// ---------------------------------------------------------------------------
// Feature registration
// ---------------------------------------------------------------------------

// System-tier features (not user-toggleable) — kept inline
const SYSTEM_FEATURES: FeatureDescriptor[] = [
  {
    id: "onboarding",
    envKey: "NEXT_PUBLIC_FEATURE_ONBOARDING",
    label: "Onboarding Wizard",
    description: "First-run setup wizard for new users.",
    defaultEnabled: true,
    tier: "system",
    plan: "free",
  },
  {
    id: "demoMode",
    envKey: "NEXT_PUBLIC_FEATURE_DEMO_MODE",
    label: "Demo Mode",
    description: "Show mock data instead of real API responses.",
    defaultEnabled: true,
    tier: "system",
    plan: "free",
  },
];

// All features = generated descriptors + system features
const FEATURES: FeatureDescriptor[] = [...featureDescriptors, ...SYSTEM_FEATURES];

// Register all features (idempotent — safe for HMR)
registerFeatures();
for (const feature of SYSTEM_FEATURES) {
  registerFeature(feature);
}

/** Typed feature IDs for this app. */
export type FeatureId =
  | "assistant"
  | "skills"
  | "workflows"
  | "briefing"
  | "notifications"
  | "mcpServers"
  | "memory"
  | "onboarding"
  | "demoMode";

// ---------------------------------------------------------------------------
// Env-var gate (web-specific — reads NEXT_PUBLIC_* via getWebEnv)
// ---------------------------------------------------------------------------

/** Map of feature envKeys for env-var lookup. */
const ENV_KEYS: Record<string, string> = {};
for (const f of FEATURES) {
  ENV_KEYS[f.id] = f.envKey;
}

/**
 * Check whether a feature's env var allows it (env gate only).
 * Does NOT consider user preferences.
 */
export function isFeatureEnabled(feature: FeatureId): boolean {
  const envKey = ENV_KEYS[feature];
  if (!envKey) return true;
  const raw = getWebEnv(envKey);
  if (raw === undefined) return true; // defaultEnabled is true for all features
  return raw !== "0" && raw !== "false";
}

/** Build env gates object for all features. */
function buildEnvGates(): Record<string, boolean> {
  const gates: Record<string, boolean> = {};
  for (const f of FEATURES) {
    gates[f.id] = isFeatureEnabled(f.id as FeatureId);
  }
  return gates;
}

// ---------------------------------------------------------------------------
// Plan resolution
// ---------------------------------------------------------------------------

const VALID_PLANS: PlanTier[] = ["free", "pro", "enterprise"];

/**
 * Read the current plan from env var or return "free".
 * In SaaS mode this will be overridden by the user's subscription stored in DB.
 * In desktop/self-hosted mode, set NEXT_PUBLIC_RADARBOARD_PLAN=enterprise to unlock all.
 */
export function getDefaultPlan(): PlanTier {
  // Must use literal process.env.NEXT_PUBLIC_* for Next.js client-side inlining
  const raw = process.env.NEXT_PUBLIC_RADARBOARD_PLAN;
  if (raw && VALID_PLANS.includes(raw as PlanTier)) return raw as PlanTier;
  return "free";
}

// ---------------------------------------------------------------------------
// Public API — delegates to SDK with env gates pre-filled
// ---------------------------------------------------------------------------

/**
 * Returns a 404 response for disabled features.
 * Use in API routes: `if (!isFeatureEnabled("skills")) return featureNotFound();`
 */
export function featureNotFound(): Response {
  return new Response("Not Found", { status: 404 });
}

/**
 * Resolve whether a feature is effectively enabled (env + user prefs + plan).
 */
export function resolveFeatureEnabled(
  feature: FeatureId,
  userPrefs?: FeaturePreferences,
  userPlan?: PlanTier
): boolean {
  return sdkResolveFeatureEnabled(
    feature,
    isFeatureEnabled(feature),
    userPrefs,
    userPlan ?? getDefaultPlan()
  );
}

/**
 * Check if a feature is locked behind a higher plan.
 */
export function isFeaturePlanLocked(feature: FeatureId, userPlan?: PlanTier): boolean {
  return sdkIsFeaturePlanLocked(feature, isFeatureEnabled(feature), userPlan ?? getDefaultPlan());
}

/**
 * List all registered features with their current state.
 */
export function listFeatures(userPrefs?: FeaturePreferences, userPlan?: PlanTier): FeatureInfo[] {
  return sdkListFeatures(buildEnvGates(), userPrefs, userPlan ?? getDefaultPlan());
}

/**
 * List only user-tier features (for the Features settings panel).
 */
export function listUserFeatures(
  userPrefs?: FeaturePreferences,
  userPlan?: PlanTier
): FeatureInfo[] {
  return sdkListUserFeatures(buildEnvGates(), userPrefs, userPlan ?? getDefaultPlan());
}

/**
 * Get settings sections that should be hidden.
 */
export function getDisabledSettingsSections(
  userPrefs?: FeaturePreferences,
  userPlan?: PlanTier
): string[] {
  return sdkGetDisabledSettingsSections(buildEnvGates(), userPrefs, userPlan ?? getDefaultPlan());
}

/**
 * Get AI tool names that should be excluded.
 */
export function getDisabledToolNames(
  userPrefs?: FeaturePreferences,
  userPlan?: PlanTier
): Set<string> {
  return sdkGetDisabledToolNames(buildEnvGates(), userPrefs, userPlan ?? getDefaultPlan());
}
