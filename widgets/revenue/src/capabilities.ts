import type { WidgetCapability } from "@radarboard/types/extension";
import type { Project } from "@radarboard/types/project";
import { resolveCapabilityProvider } from "@radarboard/widget-sdk/capability-utils";

export const REVENUE_CAPABILITIES: WidgetCapability[] = [
  {
    id: "revenue",
    role: "canonical",
    providers: [
      { integration: "revenuecat", action: "data" },
      { integration: "stripe", action: "data" },
    ],
  },
];

export function resolveRevenueProviderIntegrationId(
  projects: Project[],
  projectSlug: string | null,
  preferredIntegrationId?: string | null
): string {
  const provider = resolveCapabilityProvider(
    REVENUE_CAPABILITIES[0] ?? null,
    projects,
    projectSlug,
    preferredIntegrationId
  );

  return provider?.integration ?? "revenuecat";
}
