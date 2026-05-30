import type { UserProfile } from "@radarboard/types/database";
import { DEVELOPMENT_PROFILES, GROWTH_PROFILES, PRODUCT_PROFILES } from "./profiles";

/**
 * Profile definitions for the onboarding "About You" step.
 * Each profile maps to suggested integrations and a description.
 * Individual profiles live in ./profiles/ for easier review.
 */

export interface ProfileDefinition {
  id: UserProfile;
  label: string;
  description: string;
  emoji: string;
  /** Integration service IDs to pre-select in the integrations step. */
  suggestedIntegrations: string[];
  /** Plugin IDs to pre-select (on top of the default all-enabled). */
  suggestedPlugins?: string[];
  /** Blueprint IDs to highlight as "recommended" in the layout step. */
  suggestedBlueprints?: string[];
}

export const PROFILE_GROUPS: { label: string; profiles: ProfileDefinition[] }[] = [
  { label: "Development", profiles: DEVELOPMENT_PROFILES },
  { label: "Product & Business", profiles: PRODUCT_PROFILES },
  { label: "Growth & Marketing", profiles: GROWTH_PROFILES },
];

/** Resolve a profile definition by ID. */
export function getProfileDefinition(id: UserProfile): ProfileDefinition | undefined {
  for (const group of PROFILE_GROUPS) {
    const found = group.profiles.find((p) => p.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Given selected profiles, returns the merged set of suggested integration IDs. */
export function getSuggestedIntegrations(profiles: UserProfile[]): string[] {
  const suggestions = new Set<string>();
  for (const id of profiles) {
    const def = getProfileDefinition(id);
    if (def) {
      for (const integration of def.suggestedIntegrations) {
        suggestions.add(integration);
      }
    }
  }
  return Array.from(suggestions);
}

/** Given selected profiles, returns the merged set of suggested blueprint IDs. */
export function getSuggestedBlueprints(profiles: UserProfile[]): string[] {
  const suggestions = new Set<string>();
  for (const id of profiles) {
    const def = getProfileDefinition(id);
    if (def?.suggestedBlueprints) {
      for (const bp of def.suggestedBlueprints) {
        suggestions.add(bp);
      }
    }
  }
  return Array.from(suggestions);
}
