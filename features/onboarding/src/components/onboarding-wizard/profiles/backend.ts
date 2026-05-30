import type { ProfileDefinition } from "../profile-config";

export const backendProfile: ProfileDefinition = {
  id: "backend",
  label: "Backend Developer",
  description: "APIs, microservices, databases, infrastructure",
  emoji: "\u{2699}\u{FE0F}",
  suggestedIntegrations: ["github", "sentry", "betterstack", "pagerduty"],
  suggestedBlueprints: ["devops-monitor", "team-velocity"],
};
