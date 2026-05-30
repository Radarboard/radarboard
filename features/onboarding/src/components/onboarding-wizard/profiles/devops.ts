import type { ProfileDefinition } from "../profile-config";

export const devopsProfile: ProfileDefinition = {
  id: "devops",
  label: "DevOps / Platform",
  description: "CI/CD, infrastructure, monitoring, reliability",
  emoji: "\u{1F680}",
  suggestedIntegrations: ["github", "vercel", "sentry", "betterstack", "pagerduty"],
  suggestedBlueprints: ["devops-monitor"],
};
