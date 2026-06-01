/** Core webhook relay starts without provider handlers registered. */

const INTEGRATIONS_INIT_KEY = "__radarboardWebhookRelayIntegrationsInitialized__";

type IntegrationsInitState = typeof globalThis & {
  __radarboardWebhookRelayIntegrationsInitialized__?: boolean;
};

export function initializeIntegrations(): void {
  const state = globalThis as IntegrationsInitState;
  if (state[INTEGRATIONS_INIT_KEY]) return;

  state[INTEGRATIONS_INIT_KEY] = true;
}

initializeIntegrations();
