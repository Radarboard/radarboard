import type { ProfileDefinition } from "../profile-config";

export const indieProfile: ProfileDefinition = {
  id: "indie",
  label: "Indie Hacker",
  description: "Solo products, revenue, growth, shipping fast",
  emoji: "\u{1F4A1}",
  suggestedIntegrations: ["github", "stripe", "vercel", "openpanel", "linear"],
  suggestedBlueprints: ["indie-revenue-dashboard", "growth-dashboard"],
};
