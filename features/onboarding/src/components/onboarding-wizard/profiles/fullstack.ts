import type { ProfileDefinition } from "../profile-config";

export const fullstackProfile: ProfileDefinition = {
  id: "fullstack",
  label: "Full-Stack Developer",
  description: "Web apps, APIs, databases, deployments",
  emoji: "\u{1F527}",
  suggestedIntegrations: ["github", "vercel", "stripe", "sentry", "openpanel"],
  suggestedBlueprints: ["indie-revenue-dashboard", "team-velocity"],
};
