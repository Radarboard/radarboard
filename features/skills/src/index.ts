/**
 * @radarboard/feature-skills
 *
 * Skills feature descriptor. Depends on assistant — if assistant
 * is disabled, skills is automatically disabled too.
 */

import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";

export const skillsDescriptor: FeatureDescriptor = {
  id: "skills",
  envKey: "NEXT_PUBLIC_FEATURE_SKILLS",
  label: "Skills",
  description: "Custom and built-in AI skills for the assistant.",
  defaultEnabled: true,
  tier: "user",
  plan: "pro",
  category: "ai",
  gatedTools: ["update_skill"],
  requires: ["assistant"],
};
