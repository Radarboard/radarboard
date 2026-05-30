"use client";

import type { FeatureInfo } from "@radarboard/feature-sdk/types";
import type { BadgeProps } from "@radarboard/ui/badge";
import { Badge } from "@radarboard/ui/badge";
import { Switch } from "@radarboard/ui/switch";
import { cn } from "@radarboard/utils/cn";
import { useStore } from "@tanstack/react-store";
import { useMemo } from "react";
import { getWebEnv } from "@/lib/env";
import { type FeaturePreferences, getDefaultPlan, listUserFeatures } from "@/lib/features";
import { handleExternalLinkClick } from "@/lib/system/ui/external-url";
import { settingsStore, updateFeaturePreference } from "@/modules/settings/store/settings-store";
import { SettingsPageLayout } from "../settings-page-layout";
import { LicenseKeySection } from "./license-section";

const PLAN_BADGE_VARIANT: Record<string, BadgeProps["variant"]> = {
  pro: "warning",
  enterprise: "accent",
};

const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI & Intelligence",
  automation: "Automation",
  infrastructure: "Infrastructure",
  general: "General",
};

/** Stable category ordering. Categories not listed here appear last. */
const CATEGORY_ORDER: string[] = ["ai", "automation", "infrastructure", "general"];

function groupByCategory(
  features: FeatureInfo[]
): { id: string; label: string; items: FeatureInfo[] }[] {
  const groups = new Map<string, FeatureInfo[]>();
  for (const f of features) {
    const cat = f.category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)?.push(f);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })
    .map(([id, items]) => ({
      id,
      label: CATEGORY_LABELS[id] ?? id,
      items,
    }));
}

export function SettingsFeatures() {
  const featurePreferences = useStore(settingsStore, (s) => s.featurePreferences);
  const userPlan = useStore(settingsStore, (s) => s.userPlan);
  const features = listUserFeatures(featurePreferences as FeaturePreferences, userPlan);
  const categories = useMemo(() => groupByCategory(features), [features]);
  const checkoutUrl = getWebEnv("NEXT_PUBLIC_LEMONSQUEEZY_PRO_CHECKOUT_URL");
  // When the env plan overrides to pro/enterprise, billing UI is irrelevant
  const envPlan = getDefaultPlan();
  const billingActive = envPlan === "free";

  return (
    <SettingsPageLayout
      title="Features"
      description="Enable or disable features. Disabled features hide their UI, API routes, and AI tools."
      statusText={`${features.filter((f) => f.effectiveEnabled).length} of ${features.length} enabled`}
      statusColor="muted"
      showSearch={false}
    >
      <div className="max-w-[820px] space-y-6">
        {billingActive && <LicenseKeySection />}
        {categories.map((category) => (
          <div key={category.id}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-foreground-secondary text-w-sm uppercase tracking-widest">
                {category.label}
              </span>
              <span className="font-mono text-muted-foreground text-w-xs">
                {category.items.filter((f) => f.effectiveEnabled).length}/{category.items.length}{" "}
                enabled
              </span>
            </div>
            <div className="space-y-3">
              {category.items.map((f) => {
                const envDisabled = !f.envEnabled;
                const isLocked = f.planLocked;
                const checked = f.effectiveEnabled;

                return (
                  <div
                    key={f.id}
                    className={cn(
                      "flex items-center justify-between rounded-card border border-border bg-surface-raised px-4 py-3",
                      (envDisabled || isLocked) && "opacity-50"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-foreground-secondary text-w-sm">
                          {f.label}
                        </span>
                        {billingActive && f.plan !== "free" && (
                          <Badge variant={PLAN_BADGE_VARIANT[f.plan]} size="xs">
                            {f.plan}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-dim text-w-xs">{f.description}</div>
                      {envDisabled && (
                        <div className="mt-1 font-mono text-destructive text-w-xs">
                          Disabled by administrator
                        </div>
                      )}
                      {billingActive && isLocked && !envDisabled && (
                        <div className="mt-1 font-mono text-w-xs text-warning">
                          Requires {f.plan} plan
                          {checkoutUrl && (
                            <>
                              {" — "}
                              <a
                                href={checkoutUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(event) => handleExternalLinkClick(event, checkoutUrl)}
                                className="underline hover:text-foreground-secondary"
                              >
                                Upgrade
                              </a>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={checked}
                      disabled={envDisabled || isLocked}
                      onCheckedChange={(value) => updateFeaturePreference(f.id, value)}
                      aria-label={`Toggle ${f.label}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </SettingsPageLayout>
  );
}
