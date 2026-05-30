import type { ProfileDefinition } from "../profile-config";

export const contentCreatorProfile: ProfileDefinition = {
  id: "content-creator",
  label: "Content Creator",
  description: "Blogs, videos, newsletters, audience growth",
  emoji: "\u{270D}\u{FE0F}",
  suggestedIntegrations: ["openpanel", "resend", "github", "raindrop"],
  suggestedBlueprints: ["content-creator-hub", "growth-dashboard"],
};
