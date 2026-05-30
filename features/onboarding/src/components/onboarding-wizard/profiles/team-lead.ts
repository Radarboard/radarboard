import type { ProfileDefinition } from "../profile-config";

export const teamLeadProfile: ProfileDefinition = {
  id: "team-lead",
  label: "Team Lead / Manager",
  description: "Roadmaps, team velocity, shipping cadence",
  emoji: "\u{1F465}",
  suggestedIntegrations: ["linear", "github", "vercel", "slack", "pagerduty"],
  suggestedBlueprints: ["team-velocity"],
};
