// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  ADVANCED_SETTINGS_SECTION_STORAGE_KEY,
  DEFAULT_ADVANCED_SETTINGS_SECTION,
  DEFAULT_INTEGRATION_MODAL_TAB,
  DEFAULT_PROJECT_SETTINGS_TAB,
  DEFAULT_SETTINGS_NOTIFICATIONS_TAB,
  DEFAULT_SETTINGS_SECTION,
  getIntegrationModalTabStorageKey,
  isAdvancedSettingsSection,
  isIntegrationModalTab,
  isProjectSettingsTab,
  isSettingsAppearanceSection,
  isSettingsNotificationsTab,
  isSettingsSection,
  PROJECT_SETTINGS_TAB_STORAGE_KEY,
  readStoredAdvancedSettingsSection,
  readStoredIntegrationModalTab,
  readStoredProjectSettingsTab,
  readStoredSettingsAppearanceSection,
  readStoredSettingsLayoutSelection,
  readStoredSettingsNotificationsTab,
  readStoredSettingsSection,
  SETTINGS_APPEARANCE_SECTION_STORAGE_KEY,
  SETTINGS_LAYOUT_SELECTION_STORAGE_KEY,
  SETTINGS_NOTIFICATIONS_TAB_STORAGE_KEY,
  SETTINGS_SECTION_STORAGE_KEY,
  writeStoredAdvancedSettingsSection,
  writeStoredIntegrationModalTab,
  writeStoredProjectSettingsTab,
  writeStoredSettingsAppearanceSection,
  writeStoredSettingsLayoutSelection,
  writeStoredSettingsNotificationsTab,
  writeStoredSettingsSection,
} from "../";

describe("settings-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to the default section when storage is empty", () => {
    expect(readStoredSettingsSection(localStorage)).toBe(DEFAULT_SETTINGS_SECTION);
  });

  it("ignores invalid stored section values", () => {
    localStorage.setItem(SETTINGS_SECTION_STORAGE_KEY, "not-a-section");

    expect(readStoredSettingsSection(localStorage)).toBe(DEFAULT_SETTINGS_SECTION);
  });

  it("round-trips a valid settings section", () => {
    writeStoredSettingsSection(localStorage, "advanced");

    expect(readStoredSettingsSection(localStorage)).toBe("advanced");
  });

  it("recognizes valid settings section ids", () => {
    expect(isSettingsSection("integrations")).toBe(true);
    expect(isSettingsSection("advanced")).toBe(true);
    expect(isSettingsSection("infrastructure")).toBe(false);
    expect(isSettingsSection("unknown")).toBe(false);
  });

  it("recognizes valid advanced settings section ids", () => {
    expect(isAdvancedSettingsSection("infrastructure")).toBe(true);
    expect(isAdvancedSettingsSection("invalid")).toBe(false);
  });

  it("falls back to the default advanced section when storage is empty", () => {
    expect(readStoredAdvancedSettingsSection(localStorage)).toBe(DEFAULT_ADVANCED_SETTINGS_SECTION);
  });

  it("round-trips a valid advanced settings section", () => {
    writeStoredAdvancedSettingsSection(localStorage, "database");

    expect(readStoredAdvancedSettingsSection(localStorage)).toBe("database");
  });

  it("migrates a legacy stored advanced section into the new top-level section", () => {
    localStorage.setItem(SETTINGS_SECTION_STORAGE_KEY, "debug");

    expect(readStoredSettingsSection(localStorage)).toBe("advanced");
    expect(readStoredAdvancedSettingsSection(localStorage)).toBe("debug");
  });

  it("prefers explicit advanced section storage over the legacy top-level value", () => {
    localStorage.setItem(SETTINGS_SECTION_STORAGE_KEY, "debug");
    localStorage.setItem(ADVANCED_SETTINGS_SECTION_STORAGE_KEY, "database");

    expect(readStoredAdvancedSettingsSection(localStorage)).toBe("database");
  });

  it("falls back to the default notifications tab when storage is empty", () => {
    expect(readStoredSettingsNotificationsTab(localStorage)).toBe(
      DEFAULT_SETTINGS_NOTIFICATIONS_TAB
    );
  });

  it("ignores invalid notification tab values", () => {
    localStorage.setItem(SETTINGS_NOTIFICATIONS_TAB_STORAGE_KEY, "not-a-tab");

    expect(readStoredSettingsNotificationsTab(localStorage)).toBe(
      DEFAULT_SETTINGS_NOTIFICATIONS_TAB
    );
  });

  it("round-trips a valid notifications tab", () => {
    writeStoredSettingsNotificationsTab(localStorage, "channels");

    expect(readStoredSettingsNotificationsTab(localStorage)).toBe("channels");
  });

  it("recognizes valid notifications tab ids", () => {
    expect(isSettingsNotificationsTab("webhooks")).toBe(true);
    expect(isSettingsNotificationsTab("invalid")).toBe(false);
  });

  it("falls back to the default project settings tab when storage is empty", () => {
    expect(readStoredProjectSettingsTab(localStorage)).toBe(DEFAULT_PROJECT_SETTINGS_TAB);
  });

  it("ignores invalid project settings tab values", () => {
    localStorage.setItem(PROJECT_SETTINGS_TAB_STORAGE_KEY, "not-a-tab");

    expect(readStoredProjectSettingsTab(localStorage)).toBe(DEFAULT_PROJECT_SETTINGS_TAB);
  });

  it("round-trips a valid project settings tab", () => {
    writeStoredProjectSettingsTab(localStorage, "platforms");

    expect(readStoredProjectSettingsTab(localStorage)).toBe("platforms");
  });

  it("recognizes valid project settings tab ids", () => {
    expect(isProjectSettingsTab("dashboard")).toBe(true);
    expect(isProjectSettingsTab("invalid")).toBe(false);
  });

  it("falls back to the default integration modal tab when storage is empty", () => {
    expect(readStoredIntegrationModalTab(localStorage, "raindrop")).toBe(
      DEFAULT_INTEGRATION_MODAL_TAB
    );
  });

  it("ignores invalid stored integration modal tab values", () => {
    localStorage.setItem(getIntegrationModalTabStorageKey("raindrop"), "not-a-tab");

    expect(readStoredIntegrationModalTab(localStorage, "raindrop")).toBe(
      DEFAULT_INTEGRATION_MODAL_TAB
    );
  });

  it("round-trips a valid integration modal tab per service", () => {
    writeStoredIntegrationModalTab(localStorage, "raindrop", "events");

    expect(readStoredIntegrationModalTab(localStorage, "raindrop")).toBe("events");
  });

  it("recognizes valid integration modal tab ids", () => {
    expect(isIntegrationModalTab("access")).toBe(true);
    expect(isIntegrationModalTab("invalid")).toBe(false);
  });

  it("falls back to no appearance section when storage is empty", () => {
    expect(readStoredSettingsAppearanceSection(localStorage)).toBeNull();
  });

  it("ignores invalid appearance section values", () => {
    localStorage.setItem(SETTINGS_APPEARANCE_SECTION_STORAGE_KEY, "not-a-section");

    expect(readStoredSettingsAppearanceSection(localStorage)).toBeNull();
  });

  it("round-trips a valid appearance section", () => {
    writeStoredSettingsAppearanceSection(localStorage, "ticker");

    expect(readStoredSettingsAppearanceSection(localStorage)).toBe("ticker");
  });

  it("clears the stored appearance section when null is written", () => {
    localStorage.setItem(SETTINGS_APPEARANCE_SECTION_STORAGE_KEY, "display");

    writeStoredSettingsAppearanceSection(localStorage, null);

    expect(localStorage.getItem(SETTINGS_APPEARANCE_SECTION_STORAGE_KEY)).toBeNull();
  });

  it("recognizes valid appearance section ids", () => {
    expect(isSettingsAppearanceSection("display")).toBe(true);
    expect(isSettingsAppearanceSection("invalid")).toBe(false);
  });

  it("returns null for missing stored layout selection", () => {
    expect(readStoredSettingsLayoutSelection(localStorage)).toBeNull();
  });

  it("round-trips the selected layout id", () => {
    writeStoredSettingsLayoutSelection(localStorage, "custom-layout");

    expect(readStoredSettingsLayoutSelection(localStorage)).toBe("custom-layout");
    expect(localStorage.getItem(SETTINGS_LAYOUT_SELECTION_STORAGE_KEY)).toBe("custom-layout");
  });

  it("clears the selected layout id when null is written", () => {
    localStorage.setItem(SETTINGS_LAYOUT_SELECTION_STORAGE_KEY, "custom-layout");

    writeStoredSettingsLayoutSelection(localStorage, null);

    expect(readStoredSettingsLayoutSelection(localStorage)).toBeNull();
  });
});
