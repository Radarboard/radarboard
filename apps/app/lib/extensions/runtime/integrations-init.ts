// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.

/**
 * Side-effect import that registers all first-party integrations.
 * Import this early in the app to populate INTEGRATION_REGISTRY.
 */

import { appStoreConnectDescriptor } from "@radarboard/integration-app-store-connect";
import { astroDataSources } from "@radarboard/integration-astro/data-sources";
import { betterstackDescriptor } from "@radarboard/integration-betterstack";
import { githubDescriptor } from "@radarboard/integration-github";
import { githubSponsorsDescriptor } from "@radarboard/integration-github-sponsors";
import { googleSearchConsoleDescriptor } from "@radarboard/integration-google-search-console";
import { linearDescriptor } from "@radarboard/integration-linear";
import { npmDescriptor } from "@radarboard/integration-npm";
import { openCollectiveDescriptor } from "@radarboard/integration-open-collective";
import { openpanelDescriptor } from "@radarboard/integration-openpanel";
import { raindropDescriptor } from "@radarboard/integration-raindrop";
import { resendDescriptor } from "@radarboard/integration-resend";
import { revenuecatDescriptor } from "@radarboard/integration-revenuecat";
import { registerDataSources, registerIntegration } from "@radarboard/integration-sdk/registry";
import { sentryDescriptor } from "@radarboard/integration-sentry";
import { shippingDataSources } from "@radarboard/integration-shipping/data-sources";
import { slackDescriptor } from "@radarboard/integration-slack";
import { stripeDescriptor } from "@radarboard/integration-stripe";
import { vercelDescriptor } from "@radarboard/integration-vercel";

const INTEGRATIONS_INIT_KEY = "__radarboardAppIntegrationsInitialized__";

type IntegrationsInitState = typeof globalThis & {
  __radarboardAppIntegrationsInitialized__?: boolean;
};

export function initializeIntegrations(): void {
  const state = globalThis as IntegrationsInitState;
  if (state[INTEGRATIONS_INIT_KEY]) return;

  state[INTEGRATIONS_INIT_KEY] = true;

  registerIntegration(appStoreConnectDescriptor);
  registerIntegration(betterstackDescriptor);
  registerIntegration(githubDescriptor);
  registerIntegration(githubSponsorsDescriptor);
  registerIntegration(googleSearchConsoleDescriptor);
  registerIntegration(linearDescriptor);
  registerIntegration(npmDescriptor);
  registerIntegration(openCollectiveDescriptor);
  registerIntegration(openpanelDescriptor);
  registerIntegration(raindropDescriptor);
  registerIntegration(resendDescriptor);
  registerIntegration(revenuecatDescriptor);
  registerIntegration(sentryDescriptor);
  registerIntegration(slackDescriptor);
  registerIntegration(stripeDescriptor);
  registerIntegration(vercelDescriptor);

  // Virtual integrations — composite data sources with no IntegrationDescriptor.
  registerDataSources("shipping", shippingDataSources);
  registerDataSources("astro", astroDataSources);
}

initializeIntegrations();
