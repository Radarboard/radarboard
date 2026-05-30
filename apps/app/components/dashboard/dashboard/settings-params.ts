import type { SettingsSection } from "@/components/settings/settings-sections";

export interface SettingsChildParamPreservation {
  preserveIntegrationIntent: boolean;
  preserveIntegrationTab: boolean;
  preserveService: boolean;
}

export interface SettingsSectionChangeOptions {
  preserveChildParams?: Partial<SettingsChildParamPreservation>;
}

export interface ConnectServiceTarget {
  integrationIntent: string | null;
  isProjectSettingsIntent: boolean;
}

export function resolveConnectServiceTarget(serviceId: string): ConnectServiceTarget {
  const integrationIntent =
    serviceId.startsWith("intent:") && serviceId.length > "intent:".length
      ? serviceId.slice("intent:".length)
      : null;

  return {
    integrationIntent,
    isProjectSettingsIntent: integrationIntent?.endsWith("-project") ?? false,
  };
}

export function resolveSettingsChildParamPreservation(
  section: SettingsSection,
  {
    integrationIntent,
    integrationTab,
    service,
  }: {
    integrationIntent: string | null;
    integrationTab: string | null;
    service: string | null;
  }
): SettingsChildParamPreservation {
  const hasServiceDeepLink =
    section === "integrations" && typeof service === "string" && service.length > 0;
  const hasIntegrationIntent =
    section === "integrations" &&
    typeof integrationIntent === "string" &&
    integrationIntent.length > 0;

  return {
    preserveIntegrationIntent: hasIntegrationIntent,
    preserveIntegrationTab: hasServiceDeepLink && integrationTab !== null,
    preserveService: hasServiceDeepLink,
  };
}
