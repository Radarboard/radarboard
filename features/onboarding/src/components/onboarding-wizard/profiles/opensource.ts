import type { ProfileDefinition } from "../profile-config";

export const opensourceProfile: ProfileDefinition = {
  id: "opensource",
  label: "Open Source Maintainer",
  description: "Stars, PRs, sponsors, community health",
  emoji: "\u{1F30D}",
  suggestedIntegrations: ["github", "npm", "github-sponsors", "open-collective"],
  suggestedBlueprints: ["oss-command-center"],
};
