"use client";

import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { getWebEnv } from "@/lib/env";
import type { PlanTier } from "@/lib/features";

interface UpgradeBannerProps {
  requiredPlan: PlanTier;
  featureLabel?: string;
}

/**
 * Banner shown when a feature is locked behind a higher plan.
 * Used as the `planFallback` in `<FeatureGate>`.
 *
 * ```tsx
 * <FeatureGate
 *   feature="workflows"
 *   planFallback={(plan) => <UpgradeBanner requiredPlan={plan} featureLabel="Workflows" />}
 * >
 *   <WorkflowsPanel />
 * </FeatureGate>
 * ```
 */
export function UpgradeBanner({ requiredPlan, featureLabel }: UpgradeBannerProps) {
  const checkoutUrl = getWebEnv("NEXT_PUBLIC_LEMONSQUEEZY_PRO_CHECKOUT_URL");

  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-border bg-surface-raised px-6 py-12 text-center">
      <Badge variant="warning" size="default" className="mb-3">
        {requiredPlan}
      </Badge>
      <h3 className="font-mono text-foreground-secondary text-w-sm">
        {featureLabel ? `${featureLabel} requires` : "This feature requires"} the {requiredPlan}{" "}
        plan
      </h3>
      <p className="mt-1 max-w-sm font-mono text-dim text-w-xs">
        Upgrade your plan to unlock this feature and get the most out of Radarboard.
      </p>
      {checkoutUrl && (
        <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="mt-4">
          <Button variant="default" size="sm">
            Upgrade to {requiredPlan}
          </Button>
        </a>
      )}
    </div>
  );
}
