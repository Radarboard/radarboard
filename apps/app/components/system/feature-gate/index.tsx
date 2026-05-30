"use client";

import type { ReactNode } from "react";
import { useFeature, useFeaturePlanLocked } from "@/hooks/app/use-feature";
import type { FeatureId, PlanTier } from "@/lib/features";

interface FeatureGateProps {
  feature: FeatureId;
  children: ReactNode;
  /** Rendered when the feature is disabled (not plan-locked). Defaults to `null`. */
  fallback?: ReactNode;
  /** Rendered when the feature requires a higher plan. Receives the required plan tier. */
  planFallback?: (requiredPlan: PlanTier) => ReactNode;
}

/**
 * Declaratively gate UI behind a feature flag and/or plan tier.
 *
 * ```tsx
 * <FeatureGate
 *   feature="workflows"
 *   planFallback={(plan) => <UpgradePrompt plan={plan} />}
 * >
 *   <WorkflowsPanel />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
  planFallback,
}: FeatureGateProps) {
  const enabled = useFeature(feature);
  const { locked, requiredPlan } = useFeaturePlanLocked(feature);

  if (locked && planFallback) return <>{planFallback(requiredPlan)}</>;
  return enabled ? children : fallback;
}
