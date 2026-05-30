import type { ProfileDefinition } from "../profile-config";

export const marketingProfile: ProfileDefinition = {
  id: "marketing",
  label: "Marketing / Growth",
  description: "Campaigns, analytics, social media, conversions",
  emoji: "\u{1F4C8}",
  suggestedIntegrations: ["openpanel", "stripe", "google-search-console", "resend"],
  suggestedBlueprints: ["growth-dashboard", "seo-analytics-hub"],
};
