// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.

/**
 * Registers all feature descriptors from feature packages.
 * Import this in features.ts to populate FEATURE_REGISTRY.
 */

import { assistantDescriptor } from "@radarboard/feature-assistant";
import { briefingDescriptor } from "@radarboard/feature-briefing";
import { mcpServersDescriptor } from "@radarboard/feature-mcp-servers";
import { memoryDescriptor } from "@radarboard/feature-memory";
import { notificationsDescriptor } from "@radarboard/feature-notifications";
import { onboardingDescriptor } from "@radarboard/feature-onboarding";
import { skillsDescriptor } from "@radarboard/feature-skills";
import { workflowsDescriptor } from "@radarboard/feature-workflows";
import { registerFeature } from "@radarboard/feature-sdk/registry";
import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";

/** All feature descriptors from packages (user-tier). */
export const featureDescriptors: FeatureDescriptor[] = [
  assistantDescriptor,
  briefingDescriptor,
  mcpServersDescriptor,
  memoryDescriptor,
  notificationsDescriptor,
  onboardingDescriptor,
  skillsDescriptor,
  workflowsDescriptor,
];

/** Register all feature descriptors. Idempotent (HMR-safe). */
export function registerFeatures(): void {
  for (const descriptor of featureDescriptors) {
    registerFeature(descriptor);
  }
}
