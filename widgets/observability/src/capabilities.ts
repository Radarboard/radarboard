import type { WidgetCapability } from "@radarboard/types/extension";
import type { Project } from "@radarboard/types/project";
import { getConnectedCapabilityProviders } from "@radarboard/widget-sdk/capability-utils";

export type ObservabilityMode = "sentry" | "appstore" | "health";

export const OBSERVABILITY_CAPABILITIES: WidgetCapability[] = [
  {
    id: "errors",
    role: "canonical",
    providers: [{ integration: "sentry", action: "data" }],
  },
  {
    id: "uptime",
    role: "canonical",
    providers: [{ integration: "betterstack", action: "data" }],
  },
];

const MODE_BY_CAPABILITY: Record<(typeof OBSERVABILITY_PRIORITY)[number], ObservabilityMode> = {
  errors: "sentry",
  uptime: "health",
};

const OBSERVABILITY_PRIORITY = ["errors", "uptime"] as const;

export function resolveObservabilityMode(
  projects: Project[],
  projectSlug: string | null
): ObservabilityMode {
  for (const capabilityId of OBSERVABILITY_PRIORITY) {
    const capability =
      OBSERVABILITY_CAPABILITIES.find((entry) => entry.id === capabilityId) ?? null;
    if (getConnectedCapabilityProviders(capability, projects, projectSlug).length > 0) {
      return MODE_BY_CAPABILITY[capabilityId];
    }
  }

  return "health";
}
