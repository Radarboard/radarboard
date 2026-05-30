import type { ProfileDefinition } from "../profile-config";

export const seoProfile: ProfileDefinition = {
  id: "seo",
  label: "SEO Specialist",
  description: "Search rankings, keywords, organic traffic",
  emoji: "\u{1F50D}",
  suggestedIntegrations: ["google-search-console", "openpanel", "vercel"],
  suggestedBlueprints: ["seo-analytics-hub", "growth-dashboard"],
};
