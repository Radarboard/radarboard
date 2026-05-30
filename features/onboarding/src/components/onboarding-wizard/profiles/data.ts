import type { ProfileDefinition } from "../profile-config";

export const dataProfile: ProfileDefinition = {
  id: "data",
  label: "Data / Analytics",
  description: "Dashboards, metrics, reporting, insights",
  emoji: "\u{1F4CA}",
  suggestedIntegrations: ["openpanel", "stripe", "google-search-console", "sentry"],
  suggestedBlueprints: ["growth-dashboard", "devops-monitor"],
};
