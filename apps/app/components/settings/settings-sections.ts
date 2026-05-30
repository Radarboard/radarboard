export const ADVANCED_SETTINGS_SECTION_IDS = [
  "infrastructure",
  "features",
  "database",
  "debug",
] as const;

export const SETTINGS_SECTION_IDS = [
  // General
  "projects",
  "appearance",
  "notifications",
  "shortcuts",
  // Extensions
  "integrations",
  "plugins",
  "widgets",
  // Dashboard
  "layouts",
  "routing",
  // AI & Automation
  "ai",
  "mcp-servers",
  "workflows",
  // Advanced
  "advanced",
  // —
  "about",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTION_IDS)[number];
export type AdvancedSettingsSection = (typeof ADVANCED_SETTINGS_SECTION_IDS)[number];
