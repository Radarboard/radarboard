import type { SettingsSection } from "@/components/settings/settings-sections";

export interface SettingsChildParamPreservation {
  preserveIntegrationIntent: boolean;
  preserveIntegrationTab: boolean;
  preserveProject: boolean;
  preserveService: boolean;
}

export interface SettingsSectionChangeOptions {
  preserveChildParams?: Partial<SettingsChildParamPreservation>;
}

export interface ConnectServiceTarget {
  integrationIntent: string | null;
  isProjectSettingsIntent: boolean;
}

export interface ProjectSettingsOpenState {
  integrationIntent: string;
  projectSlug: string | null;
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

export function resolveProjectSettingsOpenState(
  serviceId: string,
  activeProjectSlug: string | null
): ProjectSettingsOpenState | null {
  const { integrationIntent, isProjectSettingsIntent } = resolveConnectServiceTarget(serviceId);

  if (!isProjectSettingsIntent || integrationIntent === null || integrationIntent.length === 0) {
    return null;
  }

  return {
    integrationIntent,
    projectSlug: activeProjectSlug,
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
  const hasProjectSetupIntent =
    section === "projects" &&
    typeof integrationIntent === "string" &&
    integrationIntent.endsWith("-project");

  return {
    preserveIntegrationIntent: hasIntegrationIntent || hasProjectSetupIntent,
    preserveIntegrationTab: hasServiceDeepLink && integrationTab !== null,
    preserveProject: hasProjectSetupIntent,
    preserveService: hasServiceDeepLink,
  };
}
