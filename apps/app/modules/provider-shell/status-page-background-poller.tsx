"use client";

import { StatusPageBackgroundPoller as StatusPageBackgroundPollerView } from "@radarboard/plugin-status-page/runtime/background-poller";
import { useDisabledPlugins } from "@/hooks/plugins/use-disabled-plugins";
import { useSettings } from "@/hooks/settings/use-settings";
import { fetchIntegrationStatusPageOverrides } from "@/lib/integration-status-pages";
import { deriveProjectHealthSources } from "@/lib/project-health-sources";
import { deriveLinkedStatusSources } from "@/lib/status-page-links";

const PLUGIN_ID = "status-page";

export function StatusPageBackgroundPoller() {
  const disabledPlugins = useDisabledPlugins();
  const { isLoading, projectIntegrations } = useSettings();

  return (
    <StatusPageBackgroundPollerView
      isDisabled={disabledPlugins.has(PLUGIN_ID)}
      isLoading={isLoading}
      projectIntegrations={projectIntegrations as Record<string, Record<string, unknown>>}
      fetchIntegrationStatusPageOverrides={fetchIntegrationStatusPageOverrides}
      deriveProjectHealthSources={
        deriveProjectHealthSources as (
          projectIntegrations: Record<string, Record<string, unknown>>,
          previousSources: Parameters<typeof deriveProjectHealthSources>[1]
        ) => ReturnType<typeof deriveProjectHealthSources>
      }
      deriveLinkedStatusSources={
        deriveLinkedStatusSources as (
          projectIntegrations: Record<string, Record<string, unknown>>,
          globalStatusPageOverrides: Record<string, string | null>,
          previousSources: Parameters<typeof deriveLinkedStatusSources>[2]
        ) => ReturnType<typeof deriveLinkedStatusSources>
      }
    />
  );
}
