import type { ProfileDefinition } from "../profile-config";

export const mobileProfile: ProfileDefinition = {
  id: "mobile",
  label: "Mobile Developer",
  description: "iOS, Android, cross-platform apps",
  emoji: "\u{1F4F1}",
  suggestedIntegrations: ["github", "app-store-connect", "revenuecat", "sentry"],
  suggestedBlueprints: ["mobile-app-tracker", "indie-revenue-dashboard"],
};
