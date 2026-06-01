/**
 * Settings store — async actions (load, save, update).
 *
 * Handles API communication, debounced persistence, optimistic updates,
 * and offline queuing. Separated from layout logic for clarity.
 */

"use client";

import type { PlanTier } from "@radarboard/feature-sdk/types";
import { API_ROUTES } from "@radarboard/types/api-routes";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import { toast } from "sonner";
import { mutate } from "swr";
import { notifyProjectGraphChanged } from "@/hooks/app/use-project-graph-invalidation";
import { getDefaultPlan } from "@/lib/features";
import { isIntegrationBackedDashboardDataKey } from "@/lib/integration-data-invalidation";
import { queueAction } from "@/lib/offline-sync";
import { type SettingsState, settingsStore } from "./settings-store";
import {
  createDefaultWidgetLayoutConfig,
  mergeWithDefaults,
  needsWidgetLayoutMigration,
  type ProjectIntegrationsMap,
} from "./settings-store-layout";

// ---------------------------------------------------------------------------
// Module-level singletons
// ---------------------------------------------------------------------------

let orderTimer: ReturnType<typeof setTimeout> | null = null;
let layoutTimer: ReturnType<typeof setTimeout> | null = null;
let loadStarted = false;

/** Max retries for settings load (server may still be starting on desktop). */
let settingsMaxRetries = 2;
let settingsRetryDelayMs = 1500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function showErrorToast(label: string, err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err);
  toast.error(label, {
    description: detail,
    duration: 8000,
    action: {
      label: "Copy",
      onClick: () => {
        import("@/lib/clipboard")
          .then(({ copyText }) => copyText(`${label}: ${detail}`))
          .catch(() => undefined);
      },
    },
  });
}

function persistMigratedLayout(merged: WidgetLayoutConfig): void {
  fetch(API_ROUTES.settings, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetLayout: merged }),
  }).catch((err) => showErrorToast("Failed to persist migrated layout", err));
}

function revalidateProjectIntegrationRoutes(): void {
  mutate(isIntegrationBackedDashboardDataKey, undefined, { revalidate: true }).catch(
    () => undefined
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Reset store and load guard — call in test beforeEach to isolate test runs. */
export function resetSettingsStoreForTesting(): void {
  loadStarted = false;
  settingsMaxRetries = 0; // Disable retries in tests
  settingsRetryDelayMs = 0;
  if (orderTimer) {
    clearTimeout(orderTimer);
    orderTimer = null;
  }
  if (layoutTimer) {
    clearTimeout(layoutTimer);
    layoutTimer = null;
  }
  settingsStore.setState(() => ({
    projectOrder: [],
    widgetLayout: createDefaultWidgetLayoutConfig(),
    projectIntegrations: {},
    featurePreferences: {},
    userPlan: "free" as PlanTier,
    isLoading: true,
  }));
}

/** Load settings from the API. No-ops if already loading/loaded. */
export async function loadSettings(attempt = 0): Promise<void> {
  if (attempt === 0 && loadStarted) return;
  loadStarted = true;
  try {
    const res = await fetch(API_ROUTES.settings);
    if (!res.ok) throw new Error("Failed to fetch settings");
    const data = (await res.json()) as {
      projectOrder: string[];
      widgetLayout: WidgetLayoutConfig | null;
      projectIntegrations: ProjectIntegrationsMap;
      featurePreferences: Record<string, boolean>;
      userPlan?: PlanTier;
    };

    const projectIntegrations = data.projectIntegrations ?? {};
    const featurePreferences = data.featurePreferences ?? {};
    const envPlan = getDefaultPlan();
    const userPlan = envPlan !== "free" ? envPlan : (data.userPlan ?? "free");
    const merged = mergeWithDefaults(data.widgetLayout, projectIntegrations);

    settingsStore.setState((s: SettingsState) => ({
      ...s,
      projectOrder: data.projectOrder,
      widgetLayout: merged,
      projectIntegrations,
      featurePreferences,
      userPlan,
      isLoading: false,
    }));

    if (needsWidgetLayoutMigration(data.widgetLayout)) {
      persistMigratedLayout(merged);
    }
  } catch (_err) {
    // Retry on failure — the sidecar server may still be starting on desktop,
    // or the DB schema may be migrating. Avoid showing error toasts to users
    // on first launch.
    if (attempt < settingsMaxRetries) {
      loadStarted = false;
      await new Promise((r) => setTimeout(r, settingsRetryDelayMs));
      return loadSettings(attempt + 1);
    }
    // After all retries, proceed with defaults instead of showing a scary toast.
    // Settings will be created on first user action (save layout, add project, etc.)
    settingsStore.setState((s: SettingsState) => ({ ...s, isLoading: false }));
  }
}

export async function reloadSettingsFromServer(): Promise<void> {
  loadStarted = false;
  settingsStore.setState((s: SettingsState) => ({ ...s, isLoading: true }));
  await loadSettings();
}

export function updateProjectOrder(newOrder: string[]): void {
  const previous = settingsStore.state.projectOrder;
  settingsStore.setState((s: SettingsState) => ({ ...s, projectOrder: newOrder }));

  if (orderTimer) clearTimeout(orderTimer);
  orderTimer = setTimeout(async () => {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueAction("UPDATE_PROJECT_ORDER", { projectOrder: newOrder });
        toast.info("Order saved offline — will sync when back online");
        return;
      }
      const res = await fetch(API_ROUTES.settings, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectOrder: newOrder }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      notifyProjectGraphChanged();
    } catch (err) {
      showErrorToast("Failed to save project order", err);
      settingsStore.setState((s: SettingsState) => ({ ...s, projectOrder: previous }));
    }
  }, 300);
}

export function updateWidgetLayout(newLayout: WidgetLayoutConfig): void {
  const previous = settingsStore.state.widgetLayout;
  settingsStore.setState((s: SettingsState) => ({ ...s, widgetLayout: newLayout }));

  if (layoutTimer) clearTimeout(layoutTimer);
  layoutTimer = setTimeout(async () => {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueAction("UPDATE_WIDGET_LAYOUT", { widgetLayout: newLayout });
        toast.info("Layout saved offline — will sync when back online");
        return;
      }
      const res = await fetch(API_ROUTES.settings, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetLayout: newLayout }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      showErrorToast("Failed to save widget layout", err);
      settingsStore.setState((s: SettingsState) => ({ ...s, widgetLayout: previous }));
    }
  }, 300);
}

export function updateFeaturePreference(featureId: string, enabled: boolean): void {
  const previous = settingsStore.state.featurePreferences;
  const updated = { ...previous, [featureId]: enabled };
  settingsStore.setState((s: SettingsState) => ({ ...s, featurePreferences: updated }));

  const save = async () => {
    try {
      const res = await fetch(API_ROUTES.settings, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featurePreferences: updated }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      showErrorToast("Failed to save feature preference", err);
      settingsStore.setState((s: SettingsState) => ({ ...s, featurePreferences: previous }));
    }
  };
  save();
}

export function updateProjectIntegrations(config: ProjectIntegrationsMap): void {
  settingsStore.setState((s: SettingsState) => ({ ...s, projectIntegrations: config }));

  const save = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueAction("UPDATE_PROJECT_INTEGRATIONS", { projectIntegrations: config });
      toast.info("Integrations saved offline");
      return;
    }
    try {
      await fetch(API_ROUTES.settings, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIntegrations: config }),
      });
      revalidateProjectIntegrationRoutes();
      notifyProjectGraphChanged();
    } catch (err) {
      showErrorToast("Failed to save project integrations", err);
    }
  };
  save();
}
