import type { UserProfile } from "@radarboard/types/database";

export type OnboardingMode = "first-run" | "returning" | "preview";

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ONBOARDING_STEPS: {
  step: OnboardingStep;
  label: string;
  skippable: boolean;
}[] = [
  { step: 1, label: "Welcome", skippable: false },
  { step: 2, label: "About You", skippable: false },
  { step: 3, label: "Database", skippable: true },
  { step: 4, label: "Integrations", skippable: false },
  { step: 5, label: "Plugins", skippable: true },
  { step: 6, label: "Layout", skippable: true },
  { step: 7, label: "Complete", skippable: false },
];

export interface OnboardingState {
  demoMode: boolean;
  /** Single profile selection from "About You" step. */
  profile: UserProfile | null;
  databaseProvider: string;
  credentials: Record<string, string>;
  connectedIntegrations: string[];
  enabledPlugins: string[];
  /** Selected blueprint ID for the dashboard layout. */
  blueprintId: string | null;
  /** True when the user restored a config snapshot on the welcome step. */
  restoredFromBackup?: boolean;
  /** True when the user chose to keep their existing settings on re-onboarding. */
  keepExisting?: boolean;
}

/** All optional plugin IDs — pre-selected in onboarding by default. */
const DEFAULT_ENABLED_PLUGINS = [
  "tasks",
  "notes",
  "bookmarks",
  "expenses",
  "status-page",
  "rss-reader",
  "webhook-relay",
  "changelog",
];

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  demoMode: false,
  profile: null,
  databaseProvider: "sqlite",
  credentials: {},
  connectedIntegrations: [],
  enabledPlugins: DEFAULT_ENABLED_PLUGINS,
  blueprintId: null,
};
