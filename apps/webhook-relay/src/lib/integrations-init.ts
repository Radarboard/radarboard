/**
 * Webhook-relay integration registration.
 *
 * Import this module for its side-effects — it registers the five
 * webhook-capable integrations so that INTEGRATION_REGISTRY is populated
 * before any handler lookup occurs.
 */

import { betterstackDescriptor } from "@radarboard/integration-betterstack";
import { githubDescriptor } from "@radarboard/integration-github";
import { linearDescriptor } from "@radarboard/integration-linear";
import { registerIntegration } from "@radarboard/integration-sdk/registry";
import { sentryDescriptor } from "@radarboard/integration-sentry";
import { vercelDescriptor } from "@radarboard/integration-vercel";

const INTEGRATIONS_INIT_KEY = "__radarboardWebhookRelayIntegrationsInitialized__";

type IntegrationsInitState = typeof globalThis & {
  __radarboardWebhookRelayIntegrationsInitialized__?: boolean;
};

export function initializeIntegrations(): void {
  const state = globalThis as IntegrationsInitState;
  if (state[INTEGRATIONS_INIT_KEY]) return;

  state[INTEGRATIONS_INIT_KEY] = true;

  registerIntegration(githubDescriptor);
  registerIntegration(vercelDescriptor);
  registerIntegration(sentryDescriptor);
  registerIntegration(betterstackDescriptor);
  registerIntegration(linearDescriptor);
}

initializeIntegrations();
