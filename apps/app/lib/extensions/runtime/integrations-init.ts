// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.

/**
 * Side-effect import that registers all first-party integrations.
 * Import this early in the app to populate INTEGRATION_REGISTRY.
 */

import { revenuecatDescriptor } from "@radarboard/integration-revenuecat";
import { registerDataSources, registerIntegration } from "@radarboard/integration-sdk/registry";
import { shippingDataSources } from "@radarboard/integration-shipping/data-sources";
import { initializeDevExtensions } from "./dev-extensions-init";
import { googleSearchConsoleDataSources } from "./server/google-search-console-data-sources";
import { linearRoadmapDataSources } from "./server/linear-roadmap-data-sources";
import { openPanelDataSources } from "./server/openpanel-data-sources";

export function initializeIntegrations(): void {
  registerIntegration(revenuecatDescriptor);

  // Virtual integrations — composite data sources with no IntegrationDescriptor.
  registerDataSources("google-search-console", googleSearchConsoleDataSources);
  registerDataSources("linear", linearRoadmapDataSources);
  registerDataSources("openpanel", openPanelDataSources);
  registerDataSources("shipping", shippingDataSources);

  // Local development integrations are explicit opt-ins from .radarboard/dev-extensions.json.
  initializeDevExtensions();
}

initializeIntegrations();
