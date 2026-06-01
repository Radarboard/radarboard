// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.

/**
 * Side-effect import that registers all first-party integrations.
 * Import this early in the app to populate INTEGRATION_REGISTRY.
 */

import { registerDataSources } from "@radarboard/integration-sdk/registry";
import { shippingDataSources } from "@radarboard/integration-shipping/data-sources";

const INTEGRATIONS_INIT_KEY = "__radarboardAppIntegrationsInitialized__";

type IntegrationsInitState = typeof globalThis & {
  __radarboardAppIntegrationsInitialized__?: boolean;
};

export function initializeIntegrations(): void {
  const state = globalThis as IntegrationsInitState;
  if (state[INTEGRATIONS_INIT_KEY]) return;

  state[INTEGRATIONS_INIT_KEY] = true;

  // Virtual integrations — composite data sources with no IntegrationDescriptor.
  registerDataSources("shipping", shippingDataSources);
}

initializeIntegrations();
