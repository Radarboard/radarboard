"use client";

import { useCredentials } from "@radarboard/hooks/use-credentials";
import { useMcpServers } from "@radarboard/hooks/use-mcp-servers";
import type { IntegrationConnection } from "@radarboard/types/database";
import type { McpServerConfig } from "@radarboard/types/mcp-server";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { useProjectIntegrations } from "@/hooks/projects/use-project-integrations";
import { useIntegrationConnections } from "@/hooks/settings/use-integration-connections";
import { CommunityExtensionDiscovery } from "../community-discovery";
import { InstallExtensionDialog } from "../extension-installer";
import { SettingsCategoryTabs } from "../settings-category-tabs";
import { filterCategorySections, normalizeCategoryId } from "../settings-category-utils";
import {
  SettingsCardSection,
  SettingsGrid,
  SettingsPageLayout,
  SettingsPageToolbar,
} from "../settings-page-layout";
import type { AdvancedSettingsSection, SettingsSection } from "../settings-sections";
import { ServiceDetailModal } from "./components/access/detail-modal";
import { ServiceCard } from "./components/access/service-card";
import { RELAY_PLATFORM, SYSTEM_KEY } from "./constants";
import type { ServiceEntry } from "./types";
import { resolveServiceDeepLink } from "./use-deeplink";
import {
  collectServices,
  getIntegrationCategories,
  getServiceApiConfigured,
  getServiceCapabilityIds,
  getServiceConnectionCount,
  getServiceConnections,
  getServiceMcpReady,
} from "./utils";

const INTEGRATION_INTENT_SERVICE_IDS: Record<string, string[]> = {
  analytics: ["openpanel", "umami"],
};

const INTEGRATION_INTENT_LABELS: Record<string, string> = {
  analytics: "Analytics",
};

function ServiceGrid({
  items,
  connections,
  connectedKeys,
  mcpServers,
  onSelectService,
}: {
  items: ServiceEntry[];
  connections: IntegrationConnection[];
  connectedKeys: string[];
  mcpServers: McpServerConfig[];
  onSelectService: (serviceId: string) => void;
}) {
  return (
    <SettingsGrid columns={5}>
      {items.map((service) => (
        <ServiceCard
          key={service.credKey}
          service={service}
          connectionCount={getServiceConnectionCount(service, connections)}
          apiConfigured={getServiceApiConfigured(service, connections, connectedKeys)}
          mcpReady={getServiceMcpReady(service, connections, mcpServers)}
          onClick={() => onSelectService(service.credKey)}
        />
      ))}
    </SettingsGrid>
  );
}

export function SettingsIntegrations({
  onOpenSettings,
}: {
  onOpenSettings?: (section: SettingsSection | AdvancedSettingsSection) => void;
} = {}) {
  const { connectedKeys, refetch: refetchCredentials } = useCredentials();
  const {
    servers: mcpServers,
    addOrUpdate: saveMcpServer,
    testConnection: testMcpServer,
  } = useMcpServers();
  const {
    connections,
    providers,
    addOrUpdate: saveConnection,
    remove: removeConnection,
  } = useIntegrationConnections();
  const { getIntegration } = useProjectIntegrations();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeServiceId, setActiveServiceId] = useQueryState(
    VIEW_STATE_QUERY_KEYS.service,
    parseAsString
  );
  const [, setIntegrationTabParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.integrationTab,
    parseAsString
  );
  const [integrationIntentParam, setIntegrationIntentParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.integrationIntent,
    parseAsString
  );
  const [settingsInstallerParam, setSettingsInstallerParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.settingsInstaller,
    parseAsString
  );
  const [installerGithubUrl, setInstallerGithubUrl] = useState("");
  const [categoryParam, setCategoryParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.integrationCategory,
    parseAsString
  );
  const installerOpen = settingsInstallerParam === "integrations";

  const services = useMemo(() => collectServices(), []);
  const categories = useMemo(() => getIntegrationCategories(services), [services]);
  const knownServiceIds = useMemo(
    () => new Set(services.map((service) => service.credKey)),
    [services]
  );
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.credKey, s])), [services]);
  const providerMap = useMemo(
    () => new Map(providers.map((provider) => [provider.provider, provider])),
    [providers]
  );
  const relayUrl = ((getIntegration(SYSTEM_KEY, RELAY_PLATFORM, "url") as string) ?? "").trim();
  const activeIntentServiceIds = useMemo(() => {
    if (!integrationIntentParam) return null;
    const ids = INTEGRATION_INTENT_SERVICE_IDS[integrationIntentParam];
    return ids ? new Set(ids) : null;
  }, [integrationIntentParam]);
  const activeCategoryId = useMemo(
    () =>
      normalizeCategoryId(
        categoryParam ?? (integrationIntentParam === "analytics" ? "analytics" : null),
        categories
      ),
    [categories, categoryParam, integrationIntentParam]
  );
  const visibleCategorySections = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    const matchingIds =
      trimmedQuery.length === 0
        ? null
        : new Set(
            services
              .filter((service) => {
                const provider = providerMap.get(service.credKey);
                const haystack = [
                  service.auth.name ?? "",
                  service.credKey,
                  ...service.usedByWidgets,
                  ...getServiceCapabilityIds(service, provider),
                ]
                  .join(" ")
                  .toLowerCase();
                return haystack.includes(trimmedQuery);
              })
              .map((service) => service.credKey)
          );

    const filteredMatchingIds =
      activeIntentServiceIds === null
        ? matchingIds
        : new Set(
            Array.from(activeIntentServiceIds).filter(
              (id) => matchingIds === null || matchingIds.has(id)
            )
          );

    return filterCategorySections({
      categories: categories.map((category) => ({
        id: category.id,
        label: category.label,
        itemIds: category.serviceIds,
      })),
      activeCategoryId,
      matchingIds: filteredMatchingIds,
    });
  }, [activeCategoryId, activeIntentServiceIds, categories, providerMap, searchQuery, services]);

  const sortedServiceMap = useMemo(() => {
    const sorted = [...services].sort((left, right) => {
      const leftConfigured = Number(
        getServiceApiConfigured(left, connections, connectedKeys) ||
          getServiceMcpReady(left, connections, mcpServers)
      );
      const rightConfigured = Number(
        getServiceApiConfigured(right, connections, connectedKeys) ||
          getServiceMcpReady(right, connections, mcpServers)
      );
      if (rightConfigured !== leftConfigured) return rightConfigured - leftConfigured;
      const connectionDelta =
        getServiceConnectionCount(right, connections) -
        getServiceConnectionCount(left, connections);
      if (connectionDelta !== 0) return connectionDelta;
      return (left.auth.name ?? left.credKey).localeCompare(right.auth.name ?? right.credKey);
    });
    return new Map(sorted.map((s) => [s.credKey, s]));
  }, [connections, connectedKeys, mcpServers, services]);

  const apiConfiguredCount = services.filter((service) =>
    getServiceApiConfigured(service, connections, connectedKeys)
  ).length;
  const mcpReadyCount = services.filter((service) =>
    getServiceMcpReady(service, connections, mcpServers)
  ).length;
  const configuredProviderCount = services.filter(
    (service) =>
      getServiceApiConfigured(service, connections, connectedKeys) ||
      getServiceMcpReady(service, connections, mcpServers)
  ).length;
  const resolvedActiveServiceId = useMemo(
    () => resolveServiceDeepLink(activeServiceId, knownServiceIds),
    [activeServiceId, knownServiceIds]
  );
  const activeService = resolvedActiveServiceId
    ? (serviceMap.get(resolvedActiveServiceId) ?? null)
    : null;

  useEffect(() => {
    if (activeServiceId !== null && resolvedActiveServiceId === null) {
      setActiveServiceId(null);
      setIntegrationTabParam(null);
    }
  }, [activeServiceId, resolvedActiveServiceId, setActiveServiceId, setIntegrationTabParam]);

  const activeProvider = activeService ? providerMap.get(activeService.credKey) : undefined;
  const activeServiceConnections = activeService
    ? getServiceConnections(activeService, connections)
    : [];

  function openInstaller(githubUrl = "") {
    setInstallerGithubUrl(githubUrl);
    setSettingsInstallerParam("integrations");
  }

  return (
    <>
      <SettingsPageLayout
        title="Integrations"
        description="Manage Radarboard API access and assistant MCP access for external services."
        statusText={`${configuredProviderCount}/${services.length} providers configured · ${apiConfiguredCount}/${services.length} APIs · ${mcpReadyCount}/${services.length} MCPs`}
        searchPlaceholder="Search services..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        headerSlot={
          <SettingsPageToolbar
            navigation={
              <SettingsCategoryTabs
                categories={categories}
                activeCategoryId={activeCategoryId}
                onChange={(categoryId) => setCategoryParam(categoryId)}
              />
            }
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={() => openInstaller()}
                uppercase={false}
                className="h-auto shrink-0 px-3 py-2 font-mono text-foreground-secondary text-w-sm uppercase tracking-wider hover:text-foreground"
              >
                Install from GitHub
              </Button>
            }
          />
        }
      >
        {integrationIntentParam && activeIntentServiceIds ? (
          <SettingsCardSection
            title={`Choose an ${INTEGRATION_INTENT_LABELS[integrationIntentParam] ?? integrationIntentParam} provider`}
            badge={
              <Button
                type="button"
                variant="ghost-link"
                uppercase={false}
                onClick={() => setIntegrationIntentParam(null)}
                className="font-mono text-accent text-w-sm"
              >
                Show all integrations
              </Button>
            }
          >
            <ServiceGrid
              items={services.filter((service) => activeIntentServiceIds.has(service.credKey))}
              connections={connections}
              connectedKeys={connectedKeys}
              mcpServers={mcpServers}
              onSelectService={setActiveServiceId}
            />
          </SettingsCardSection>
        ) : null}
        {!integrationIntentParam && visibleCategorySections.length === 0 ? (
          <>
            <EmptyState message="No services match your current filters." />
            <CommunityExtensionDiscovery
              type="integration"
              searchQuery={searchQuery}
              onInstall={openInstaller}
            />
          </>
        ) : !integrationIntentParam ? (
          <>
            {visibleCategorySections.map((category) => {
              const sectionServices = category.itemIds
                .map((id) => sortedServiceMap.get(id))
                .filter((s): s is ServiceEntry => s !== undefined);

              if (sectionServices.length === 0) return null;

              const configuredInCategory = sectionServices.filter(
                (s) =>
                  getServiceApiConfigured(s, connections, connectedKeys) ||
                  getServiceMcpReady(s, connections, mcpServers)
              ).length;

              return (
                <SettingsCardSection
                  key={category.id}
                  title={category.label}
                  badge={
                    configuredInCategory > 0 ? (
                      <span className="rounded-item border border-border bg-card px-2 py-0.5 font-mono text-muted-foreground text-w-sm">
                        {configuredInCategory} configured
                      </span>
                    ) : undefined
                  }
                >
                  <ServiceGrid
                    items={sectionServices}
                    connections={connections}
                    connectedKeys={connectedKeys}
                    mcpServers={mcpServers}
                    onSelectService={setActiveServiceId}
                  />
                </SettingsCardSection>
              );
            })}
            <CommunityExtensionDiscovery
              type="integration"
              searchQuery={searchQuery}
              onInstall={openInstaller}
            />
          </>
        ) : null}
      </SettingsPageLayout>

      <InstallExtensionDialog
        open={installerOpen}
        initialGithubUrl={installerGithubUrl}
        onOpenChange={(open) => {
          if (!open) setInstallerGithubUrl("");
          setSettingsInstallerParam(open ? "integrations" : null);
        }}
      />
      {activeService !== null && (
        <ServiceDetailModal
          service={activeService}
          connections={activeServiceConnections}
          provider={activeProvider}
          mcpServers={mcpServers}
          connectedKeys={connectedKeys}
          relayUrl={relayUrl}
          open={resolvedActiveServiceId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setActiveServiceId(null);
              setIntegrationTabParam(null);
            }
          }}
          onManageRelay={() => {
            setActiveServiceId(null);
            setIntegrationTabParam(null);
            onOpenSettings?.("infrastructure");
          }}
          apiConfigured={getServiceApiConfigured(activeService, connections, connectedKeys)}
          mcpReady={getServiceMcpReady(activeService, connections, mcpServers)}
          saveMcpServer={saveMcpServer}
          testMcpServer={testMcpServer}
          saveConnection={saveConnection}
          removeConnection={removeConnection}
          onCredentialChange={() => refetchCredentials()}
        />
      )}
    </>
  );
}
