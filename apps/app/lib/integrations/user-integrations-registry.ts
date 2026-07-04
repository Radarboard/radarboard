/**
 * Runtime registry bridge for user-defined (no-code) REST integrations.
 *
 * User integrations are stored as serializable `UserRestIntegrationConfig[]` in
 * the settings repository. This module loads them, hydrates each into a live
 * `IntegrationDescriptor` (via {@link buildRestIntegrationFromUserConfig}), and
 * registers it in the SDK's `INTEGRATION_REGISTRY` — the same registry the
 * built-in integrations use. Registration is idempotent, so this can run at
 * boot and again lazily without duplicating entries.
 */
import {
  getIntegration,
  registerIntegration,
  unregisterIntegration,
} from "@radarboard/integration-sdk/registry";
import { createLogger } from "@radarboard/logger/logger";
import type { SettingsRepository } from "@radarboard/types/database";
import { getSettingsRepo } from "@/data/core/repository";
import {
  buildRestIntegrationFromUserConfig,
  type UserRestIntegrationConfig,
} from "./user-rest-integration";

const log = createLogger("integrations/user-registry");

/** Load the persisted user integration configs from settings. Never throws. */
export async function loadUserIntegrationConfigs(
  repo: SettingsRepository = getSettingsRepo()
): Promise<UserRestIntegrationConfig[]> {
  try {
    const raw = await repo.getUserIntegrations();
    return Array.isArray(raw) ? (raw as UserRestIntegrationConfig[]) : [];
  } catch (error) {
    log.error("Failed to load user integrations", { error });
    return [];
  }
}

/**
 * Hydrate + register every persisted user integration. Invalid configs are
 * skipped (and logged) so one bad entry can't block the rest. Returns the count
 * of successfully registered integrations.
 */
export async function registerUserIntegrations(
  repo: SettingsRepository = getSettingsRepo()
): Promise<number> {
  const configs = await loadUserIntegrationConfigs(repo);
  const { ensureRestWidgetRegistered } = await import("./rest-widget-registry");
  let registered = 0;
  for (const config of configs) {
    const result = buildRestIntegrationFromUserConfig(config);
    if (!result.ok) {
      log.warn("Skipping invalid user integration", { id: config?.id, error: result.error });
      continue;
    }
    try {
      registerIntegration(result.descriptor);
      ensureRestWidgetRegistered(config.id, config.name);
      registered += 1;
    } catch (error) {
      log.error("Failed to register user integration", { id: config.id, error });
    }
  }
  return registered;
}

// Memoize so repeated calls across Next.js route chunks register only once per
// process. Registration itself is idempotent, but this avoids redundant DB reads.
let registerPromise: Promise<number> | null = null;

/** Register user integrations once per process (idempotent, cached). */
export function ensureUserIntegrationsRegistered(
  repo: SettingsRepository = getSettingsRepo()
): Promise<number> {
  if (!registerPromise) {
    registerPromise = registerUserIntegrations(repo).catch((error) => {
      // Reset on failure so a later call can retry.
      registerPromise = null;
      log.error("ensureUserIntegrationsRegistered failed", { error });
      return 0;
    });
  }
  return registerPromise;
}

export interface SaveUserIntegrationResult {
  ok: boolean;
  id: string;
  /** True when an existing user integration with the same id was replaced. */
  updated?: boolean;
  /** Data-source actions exposed by the registered integration. */
  dataSourceActions?: string[];
  error?: string;
}

/**
 * Validate, persist, and live-register a user-defined REST integration.
 *
 * - Rejects configs that fail hydration (invalid id/category/baseUrl/etc.).
 * - Rejects ids that collide with a built-in integration (avoids shadowing).
 * - Upserts by id in the settings store, then (re-)registers the descriptor so
 *   it's usable immediately without a restart.
 */
export async function saveUserIntegration(
  config: UserRestIntegrationConfig,
  repo: SettingsRepository = getSettingsRepo()
): Promise<SaveUserIntegrationResult> {
  const built = buildRestIntegrationFromUserConfig(config);
  if (!built.ok) {
    return { ok: false, id: config?.id ?? "", error: built.error };
  }

  const existing = await loadUserIntegrationConfigs(repo);
  const isKnownUserIntegration = existing.some((c) => c?.id === config.id);

  // A built-in integration already owns this id → refuse to shadow it.
  if (!isKnownUserIntegration && getIntegration(config.id)) {
    return {
      ok: false,
      id: config.id,
      error: `Integration id "${config.id}" is already in use. Choose a different id.`,
    };
  }

  const next = [...existing.filter((c) => c?.id !== config.id), config];
  try {
    await repo.setUserIntegrations(next);
  } catch (error) {
    log.error("Failed to persist user integration", { id: config.id, error });
    return {
      ok: false,
      id: config.id,
      error: error instanceof Error ? error.message : "Failed to persist integration.",
    };
  }

  // Re-register so an updated descriptor actually takes effect (registration is
  // idempotent, so a stale entry must be cleared first).
  if (isKnownUserIntegration) unregisterIntegration(config.id);
  registerIntegration(built.descriptor);

  // Register the integration's dedicated dashboard widget too.
  const { ensureRestWidgetRegistered } = await import("./rest-widget-registry");
  ensureRestWidgetRegistered(config.id, config.name);

  return {
    ok: true,
    id: config.id,
    updated: isKnownUserIntegration,
    dataSourceActions: config.dataSources.map((ds) => ds.action),
  };
}

/** Test-only: clear the memoized registration promise. */
export function resetUserIntegrationsRegistrationForTesting(): void {
  registerPromise = null;
}
