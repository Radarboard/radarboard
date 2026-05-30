import type { ProfileDefinition } from "../profile-config";

export const frontendProfile: ProfileDefinition = {
  id: "frontend",
  label: "Frontend Developer",
  description: "UI/UX, components, performance, accessibility",
  emoji: "\u{1F3A8}",
  suggestedIntegrations: ["github", "vercel", "openpanel", "sentry"],
  suggestedBlueprints: ["team-velocity", "seo-analytics-hub"],
};
