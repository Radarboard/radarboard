"use client";

import { useMemo } from "react";
import { useProjectIntegrations } from "@/hooks/projects/use-project-integrations";
import {
  RELAY_PLATFORM,
  SYSTEM_KEY,
  WEBHOOK_SERVICE_CONFIG,
  WEBHOOK_SERVICE_IDS,
} from "../settings-integrations/constants";
import { SettingsGrid, SettingsPageLayout } from "../settings-page-layout";
import { normalizeRelayUrl, RelaySettingsPanel, RelayUsagePanel } from "../settings-webhook-relay";

export function SettingsInfrastructure() {
  const { getIntegration, updateIntegration } = useProjectIntegrations();
  const relayUrl = ((getIntegration(SYSTEM_KEY, RELAY_PLATFORM, "url") as string) ?? "").trim();
  const normalizedRelayUrl = useMemo(() => normalizeRelayUrl(relayUrl), [relayUrl]);
  const webhookServiceLabels = useMemo(
    () => WEBHOOK_SERVICE_IDS.map((serviceId) => WEBHOOK_SERVICE_CONFIG[serviceId].label),
    []
  );

  return (
    <SettingsPageLayout
      title="Infrastructure"
      description="Manage shared inbound-service configuration used across Radarboard integrations."
      statusText={
        normalizedRelayUrl ? "Relay base URL configured" : "Relay base URL not configured"
      }
      statusColor={normalizedRelayUrl ? "green" : "muted"}
      showSearch={false}
    >
      <SettingsGrid columns={3}>
        <RelaySettingsPanel
          relayUrl={relayUrl}
          onSaveRelayUrl={(url) => updateIntegration(SYSTEM_KEY, RELAY_PLATFORM, "url", url)}
          serviceLabels={webhookServiceLabels}
        />
        <RelayUsagePanel relayUrl={normalizedRelayUrl} serviceLabels={webhookServiceLabels} />
      </SettingsGrid>
    </SettingsPageLayout>
  );
}
