/**
 * @radarboard/feature-onboarding
 *
 * Isolated onboarding feature package.
 * Exports the feature descriptor, wizard component, and public API.
 */

import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";
import { OnboardingWizard } from "./components/onboarding-wizard";
import {
  getProfileDefinition,
  getSuggestedBlueprints,
  getSuggestedIntegrations,
  PROFILE_GROUPS,
} from "./components/onboarding-wizard/profile-config";

export const onboardingDescriptor: FeatureDescriptor = {
  id: "onboarding",
  envKey: "NEXT_PUBLIC_FEATURE_ONBOARDING",
  label: "Onboarding Wizard",
  description: "First-run setup wizard for new users.",
  defaultEnabled: true,
  tier: "system",
  plan: "free",
  ui: {
    wizard: OnboardingWizard,
  },
  resources: {
    PROFILE_GROUPS,
    getProfileDefinition,
    getSuggestedBlueprints,
    getSuggestedIntegrations,
  },
};

export { OnboardingWizard } from "./components/onboarding-wizard";
export type { OnboardingStepProps } from "./components/onboarding-wizard";
export type { OnboardingState, OnboardingStep, OnboardingMode } from "./components/onboarding-wizard/types";
export {
  PROFILE_GROUPS,
  getSuggestedIntegrations,
  getSuggestedBlueprints,
  getProfileDefinition,
} from "./components/onboarding-wizard/profile-config";
export type { ProfileDefinition } from "./components/onboarding-wizard/profile-config";
export { useSetupProgress } from "./hooks/use-setup-progress";
