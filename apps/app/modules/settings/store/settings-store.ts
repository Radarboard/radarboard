/**
 * Settings store — barrel export.
 *
 * Re-exports the Store instance, types, layout helpers, and async actions
 * from their focused modules. Import from this file for backward compat:
 *
 *   import { settingsStore, loadSettings, updateWidgetLayout } from "@/modules/settings/store/settings-store";
 *
 * Or import directly from sub-modules for tree-shaking:
 *
 *   import { createDefaultWidgetLayoutConfig } from "@/modules/settings/store/settings-store-layout";
 *   import { loadSettings } from "@/modules/settings/store/settings-store-actions";
 */

"use client";

import type { PlanTier } from "@radarboard/feature-sdk/types";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import { Store } from "@tanstack/react-store";
import {
  loadSettings,
  reloadSettingsFromServer,
  resetSettingsStoreForTesting,
  updateFeaturePreference,
  updateProjectIntegrations,
  updateProjectOrder,
  updateWidgetLayout,
} from "./settings-store-actions";
import { createDefaultWidgetLayoutConfig, mergeWithDefaults } from "./settings-store-layout";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { ProjectIntegrationsMap, SlotMap } from "./settings-store-layout";

export interface SettingsState {
  projectOrder: string[];
  widgetLayout: WidgetLayoutConfig;
  projectIntegrations: Record<string, Record<string, Record<string, unknown>>>;
  featurePreferences: Record<string, boolean>;
  userPlan: PlanTier;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Store instance
// ---------------------------------------------------------------------------

export const settingsStore = new Store<SettingsState>({
  projectOrder: [],
  widgetLayout: createDefaultWidgetLayoutConfig(),
  projectIntegrations: {},
  featurePreferences: {},
  userPlan: "free",
  isLoading: true,
});

// ---------------------------------------------------------------------------
// Re-exports for backward compatibility
// ---------------------------------------------------------------------------

export {
  createDefaultWidgetLayoutConfig,
  loadSettings,
  mergeWithDefaults,
  reloadSettingsFromServer,
  resetSettingsStoreForTesting,
  updateFeaturePreference,
  updateProjectIntegrations,
  updateProjectOrder,
  updateWidgetLayout,
};
