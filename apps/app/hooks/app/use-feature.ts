"use client";

import { getFeature } from "@radarboard/feature-sdk/registry";
import { useStore } from "@tanstack/react-store";
import {
  type FeatureId,
  type FeaturePreferences,
  isFeaturePlanLocked,
  type PlanTier,
  resolveFeatureEnabled,
} from "@/lib/features";
import { settingsStore } from "@/modules/settings/store/settings-store";

/**
 * Resolve whether a feature is effectively enabled, combining the env-var
 * gate, plan check, and user preferences from the settings store.
 *
 * Re-renders automatically when user preferences or plan change in the store.
 */
export function useFeature(feature: FeatureId): boolean {
  const featurePreferences = useStore(settingsStore, (s) => s.featurePreferences);
  const userPlan = useStore(settingsStore, (s) => s.userPlan);
  return resolveFeatureEnabled(feature, featurePreferences as FeaturePreferences, userPlan);
}

/**
 * Check if a feature is locked behind a higher plan than the user's current plan.
 * Returns the required plan tier for upgrade prompts.
 */
export function useFeaturePlanLocked(feature: FeatureId): {
  locked: boolean;
  requiredPlan: PlanTier;
} {
  const userPlan = useStore(settingsStore, (s) => s.userPlan);
  const locked = isFeaturePlanLocked(feature, userPlan);
  const descriptor = getFeature(feature);
  return { locked, requiredPlan: descriptor?.plan ?? "free" };
}
