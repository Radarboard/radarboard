import {
  ADVANCED_SETTINGS_SECTION_IDS,
  type AdvancedSettingsSection,
  SETTINGS_SECTION_IDS,
  type SettingsSection,
} from "../settings-sections";

export const DEFAULT_SETTINGS_SECTION: SettingsSection = "projects";
export const DEFAULT_ADVANCED_SETTINGS_SECTION: AdvancedSettingsSection = "infrastructure";
export const SETTINGS_SECTION_STORAGE_KEY = "radarboard:settings:last-section";
export const ADVANCED_SETTINGS_SECTION_STORAGE_KEY = "radarboard:settings:last-advanced-section";
export const DEFAULT_SETTINGS_NOTIFICATIONS_TAB = "sources";
export const SETTINGS_NOTIFICATIONS_TAB_STORAGE_KEY = "radarboard:settings:notifications-tab";
export const DEFAULT_PROJECT_SETTINGS_TAB = "overview";
export const PROJECT_SETTINGS_TAB_STORAGE_KEY = "radarboard:settings:projects-tab";
export const DEFAULT_INTEGRATION_MODAL_TAB = "access";
export const SETTINGS_APPEARANCE_SECTION_STORAGE_KEY = "radarboard:settings:appearance-section";
export const SETTINGS_LAYOUT_SELECTION_STORAGE_KEY = "radarboard:settings:layouts:selected-id";

const VALID_SETTINGS_SECTION_SET = new Set<string>(SETTINGS_SECTION_IDS);
const VALID_ADVANCED_SETTINGS_SECTION_SET = new Set<string>(ADVANCED_SETTINGS_SECTION_IDS);
const INTEGRATION_MODAL_TAB_IDS = ["access", "data", "events"] as const;
const SETTINGS_NOTIFICATIONS_TAB_IDS = [
  "sources",
  "quiet-hours",
  "rules",
  "webhooks",
  "channels",
] as const;
const PROJECT_SETTINGS_TAB_IDS = ["overview", "dashboard", "platforms"] as const;
const SETTINGS_APPEARANCE_SECTION_IDS = ["display", "timezone", "ticker"] as const;
const VALID_INTEGRATION_MODAL_TAB_SET = new Set<string>(INTEGRATION_MODAL_TAB_IDS);
const VALID_SETTINGS_NOTIFICATIONS_TAB_SET = new Set<string>(SETTINGS_NOTIFICATIONS_TAB_IDS);
const VALID_PROJECT_SETTINGS_TAB_SET = new Set<string>(PROJECT_SETTINGS_TAB_IDS);
const VALID_SETTINGS_APPEARANCE_SECTION_SET = new Set<string>(SETTINGS_APPEARANCE_SECTION_IDS);

export type SettingsNotificationsTab = (typeof SETTINGS_NOTIFICATIONS_TAB_IDS)[number];
export type ProjectSettingsTab = (typeof PROJECT_SETTINGS_TAB_IDS)[number];
export type IntegrationModalTab = (typeof INTEGRATION_MODAL_TAB_IDS)[number];
export type SettingsAppearanceSection = (typeof SETTINGS_APPEARANCE_SECTION_IDS)[number];

export function isSettingsSection(value: string | null | undefined): value is SettingsSection {
  return value !== null && value !== undefined && VALID_SETTINGS_SECTION_SET.has(value);
}

export function isAdvancedSettingsSection(
  value: string | null | undefined
): value is AdvancedSettingsSection {
  return value !== null && value !== undefined && VALID_ADVANCED_SETTINGS_SECTION_SET.has(value);
}

export function isIntegrationModalTab(
  value: string | null | undefined
): value is IntegrationModalTab {
  return value !== null && value !== undefined && VALID_INTEGRATION_MODAL_TAB_SET.has(value);
}

export function getIntegrationModalTabStorageKey(serviceId: string): string {
  return `radarboard:settings:integration-modal-tab:${serviceId}`;
}

export function readStoredIntegrationModalTab(
  storage: Pick<Storage, "getItem"> | null | undefined,
  serviceId: string
): IntegrationModalTab {
  const storedValue = storage?.getItem(getIntegrationModalTabStorageKey(serviceId)) ?? null;
  return isIntegrationModalTab(storedValue) ? storedValue : DEFAULT_INTEGRATION_MODAL_TAB;
}

export function writeStoredIntegrationModalTab(
  storage: Pick<Storage, "setItem"> | null | undefined,
  serviceId: string,
  tab: IntegrationModalTab
) {
  storage?.setItem(getIntegrationModalTabStorageKey(serviceId), tab);
}

export function readStoredSettingsSection(
  storage: Pick<Storage, "getItem"> | null | undefined
): SettingsSection {
  const storedValue = storage?.getItem(SETTINGS_SECTION_STORAGE_KEY) ?? null;
  if (isAdvancedSettingsSection(storedValue)) return "advanced";
  return isSettingsSection(storedValue) ? storedValue : DEFAULT_SETTINGS_SECTION;
}

export function writeStoredSettingsSection(
  storage: Pick<Storage, "setItem"> | null | undefined,
  section: SettingsSection
) {
  storage?.setItem(SETTINGS_SECTION_STORAGE_KEY, section);
}

export function readStoredAdvancedSettingsSection(
  storage: Pick<Storage, "getItem"> | null | undefined
): AdvancedSettingsSection {
  const storedAdvancedValue = storage?.getItem(ADVANCED_SETTINGS_SECTION_STORAGE_KEY) ?? null;
  if (isAdvancedSettingsSection(storedAdvancedValue)) return storedAdvancedValue;

  const legacySectionValue = storage?.getItem(SETTINGS_SECTION_STORAGE_KEY) ?? null;
  return isAdvancedSettingsSection(legacySectionValue)
    ? legacySectionValue
    : DEFAULT_ADVANCED_SETTINGS_SECTION;
}

export function writeStoredAdvancedSettingsSection(
  storage: Pick<Storage, "setItem"> | null | undefined,
  section: AdvancedSettingsSection
) {
  storage?.setItem(ADVANCED_SETTINGS_SECTION_STORAGE_KEY, section);
}

export function isSettingsNotificationsTab(
  value: string | null | undefined
): value is SettingsNotificationsTab {
  return value !== null && value !== undefined && VALID_SETTINGS_NOTIFICATIONS_TAB_SET.has(value);
}

export function readStoredSettingsNotificationsTab(
  storage: Pick<Storage, "getItem"> | null | undefined
): SettingsNotificationsTab {
  const storedValue = storage?.getItem(SETTINGS_NOTIFICATIONS_TAB_STORAGE_KEY) ?? null;
  return isSettingsNotificationsTab(storedValue) ? storedValue : DEFAULT_SETTINGS_NOTIFICATIONS_TAB;
}

export function writeStoredSettingsNotificationsTab(
  storage: Pick<Storage, "setItem"> | null | undefined,
  tab: SettingsNotificationsTab
) {
  storage?.setItem(SETTINGS_NOTIFICATIONS_TAB_STORAGE_KEY, tab);
}

export function isProjectSettingsTab(
  value: string | null | undefined
): value is ProjectSettingsTab {
  return value !== null && value !== undefined && VALID_PROJECT_SETTINGS_TAB_SET.has(value);
}

export function readStoredProjectSettingsTab(
  storage: Pick<Storage, "getItem"> | null | undefined
): ProjectSettingsTab {
  const storedValue = storage?.getItem(PROJECT_SETTINGS_TAB_STORAGE_KEY) ?? null;
  return isProjectSettingsTab(storedValue) ? storedValue : DEFAULT_PROJECT_SETTINGS_TAB;
}

export function writeStoredProjectSettingsTab(
  storage: Pick<Storage, "setItem"> | null | undefined,
  tab: ProjectSettingsTab
) {
  storage?.setItem(PROJECT_SETTINGS_TAB_STORAGE_KEY, tab);
}

export function isSettingsAppearanceSection(
  value: string | null | undefined
): value is SettingsAppearanceSection {
  return value !== null && value !== undefined && VALID_SETTINGS_APPEARANCE_SECTION_SET.has(value);
}

export function readStoredSettingsAppearanceSection(
  storage: Pick<Storage, "getItem"> | null | undefined
): SettingsAppearanceSection | null {
  const storedValue = storage?.getItem(SETTINGS_APPEARANCE_SECTION_STORAGE_KEY) ?? null;
  return isSettingsAppearanceSection(storedValue) ? storedValue : null;
}

export function writeStoredSettingsAppearanceSection(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  section: SettingsAppearanceSection | null
) {
  if (section === null) {
    storage?.removeItem(SETTINGS_APPEARANCE_SECTION_STORAGE_KEY);
    return;
  }

  storage?.setItem(SETTINGS_APPEARANCE_SECTION_STORAGE_KEY, section);
}

export function readStoredSettingsLayoutSelection(
  storage: Pick<Storage, "getItem"> | null | undefined
): string | null {
  const storedValue = storage?.getItem(SETTINGS_LAYOUT_SELECTION_STORAGE_KEY) ?? null;
  return storedValue && storedValue.trim().length > 0 ? storedValue : null;
}

export function writeStoredSettingsLayoutSelection(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  layoutId: string | null
) {
  if (!layoutId) {
    storage?.removeItem(SETTINGS_LAYOUT_SELECTION_STORAGE_KEY);
    return;
  }

  storage?.setItem(SETTINGS_LAYOUT_SELECTION_STORAGE_KEY, layoutId);
}
