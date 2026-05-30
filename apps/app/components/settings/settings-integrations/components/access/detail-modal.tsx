"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { IntegrationConnection } from "@radarboard/types/database";
import type { McpServerConfig } from "@radarboard/types/mcp-server";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo } from "react";
import { PollingSourceControls } from "@/components/settings/polling-controls";
import { INTEGRATION_MODAL_TAB_META } from "@/components/settings/settings-integrations/constants";
import type {
  IntegrationModalTab,
  McpConnectionTestPayload,
  McpConnectionTestResult,
  ServiceEntry,
} from "@/components/settings/settings-integrations/types";
import {
  getVisibleIntegrationModalTabs,
  isWebhookService,
  resolveIntegrationModalTab,
} from "@/components/settings/settings-integrations/utils";
import { RemoteServiceIcon } from "@/components/shared/remote-service-icon";
import type { IntegrationProviderDefinition } from "@/hooks/settings/use-integration-connections";
import { getServiceFaviconUrl } from "@/lib/service-favicons";
import { IntegrationNotificationsCard } from "../channels/notification-card";
import { IntegrationRssFeedCard } from "../channels/rss-card";
import { IntegrationStatusPageCard } from "../channels/status-card";
import { IntegrationWebhookCard } from "../channels/webhook-card";
import { IntegrationConnectionCard } from "./connection-card";
import { ConfigFlowWizard } from "./flow-wizard";

const INTEGRATION_MODAL_TAB_IDS = ["access", "data", "events"] as const;

function IntegrationModalTabBar({
  activeTab,
  tabs,
  onChange,
}: {
  activeTab: IntegrationModalTab;
  tabs: IntegrationModalTab[];
  onChange: (tab: IntegrationModalTab) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-border border-b pb-3">
      {INTEGRATION_MODAL_TAB_META.filter((tab) => tabs.includes(tab.id)).map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant={activeTab === tab.id ? "default" : "outline"}
          onClick={() => onChange(tab.id)}
          aria-pressed={activeTab === tab.id}
          rounded-item="none"
          className={cn(
            "h-auto px-3 py-1.5 font-mono text-w-sm uppercase tracking-[0.16em] transition-colors",
            activeTab === tab.id
              ? "border-accent/30 bg-accent/20 text-accent"
              : "border-border text-dim hover:text-foreground-secondary"
          )}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

export function ServiceDetailModal({
  service,
  connections,
  provider,
  mcpServers,
  connectedKeys,
  relayUrl,
  open,
  onOpenChange,
  onManageRelay,
  apiConfigured,
  saveMcpServer,
  testMcpServer,
  saveConnection,
  removeConnection,
  onCredentialChange,
}: {
  service: ServiceEntry;
  connections: IntegrationConnection[];
  provider: IntegrationProviderDefinition | undefined;
  mcpServers: McpServerConfig[];
  connectedKeys: string[];
  relayUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManageRelay: () => void;
  apiConfigured: boolean;
  mcpReady: boolean;
  saveMcpServer: (server: McpServerConfig) => Promise<void>;
  testMcpServer: (payload: McpConnectionTestPayload) => Promise<McpConnectionTestResult>;
  saveConnection: (connection: IntegrationConnection) => Promise<void>;
  removeConnection: (connectionId: string) => Promise<void>;
  onCredentialChange: () => void;
}) {
  const faviconUrl = getServiceFaviconUrl(service.credKey, 32);
  const webhookServiceId = isWebhookService(service.credKey) ? service.credKey : null;
  const visibleTabs = useMemo(() => getVisibleIntegrationModalTabs(service), [service]);
  const [activeTabParam, setActiveTabParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.integrationTab,
    parseAsStringLiteral(INTEGRATION_MODAL_TAB_IDS)
  );
  const defaultActiveTab = resolveIntegrationModalTab(service, visibleTabs, apiConfigured);
  const activeTab =
    activeTabParam && visibleTabs.includes(activeTabParam as IntegrationModalTab)
      ? (activeTabParam as IntegrationModalTab)
      : defaultActiveTab;

  useEffect(() => {
    if (!open) {
      if (activeTabParam !== null) {
        setActiveTabParam(null);
      }
      return;
    }
    if (activeTabParam === activeTab) return;
    setActiveTabParam(activeTab);
  }, [activeTab, activeTabParam, open, setActiveTabParam]);

  const handleTabChange = useCallback(
    (tab: IntegrationModalTab) => {
      setActiveTabParam(tab);
    },
    [setActiveTabParam]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" nested className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            {faviconUrl ? (
              <RemoteServiceIcon src={faviconUrl} alt="" size={20} className="rounded-item" />
            ) : null}
            {service.auth.name ?? service.credKey}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Integration service details and configuration
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 overflow-x-hidden">
          <IntegrationModalTabBar
            activeTab={activeTab}
            tabs={visibleTabs}
            onChange={handleTabChange}
          />

          <div className="min-w-0 space-y-4">
            {activeTab === "access" ? (
              <>
                {service.configFlow && connectedKeys.length === 0 ? (
                  <ConfigFlowWizard
                    configFlow={service.configFlow}
                    onComplete={async (values) => {
                      await fetch(API_ROUTES.credentials, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key: service.credKey, values }),
                      });
                      onCredentialChange();
                    }}
                    onCancel={() => {
                      // Fall through to manual form
                    }}
                  />
                ) : null}
                <IntegrationConnectionCard
                  service={service}
                  connections={connections}
                  provider={provider}
                  mcpServers={mcpServers}
                  connectedKeys={connectedKeys}
                  saveMcpServer={saveMcpServer}
                  testMcpServer={testMcpServer}
                  saveConnection={saveConnection}
                  removeConnection={removeConnection}
                  onCredentialChange={onCredentialChange}
                />
              </>
            ) : null}

            {activeTab === "data" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  <PollingSourceControls
                    sourceIds={service.pollingSourceIds}
                    description="Control how often Radarboard refreshes cached data from this integration."
                    sourceHints={
                      service.credKey === "sentry"
                        ? {
                            "sentry-projects":
                              "Used by project settings when choosing Sentry projects.",
                          }
                        : undefined
                    }
                  />
                </div>
                <div className="space-y-4">
                  <IntegrationRssFeedCard
                    serviceId={service.credKey}
                    defaultRssFeedUrl={service.defaultRssFeedUrl}
                  />

                  {service.integrationKey ? (
                    <IntegrationStatusPageCard
                      integrationKey={service.integrationKey!}
                      defaultStatusPageUrl={service.defaultStatusPageUrl}
                    />
                  ) : (
                    <div aria-hidden="true" className="min-h-full" />
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "events" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  {webhookServiceId ? (
                    <IntegrationWebhookCard
                      serviceId={webhookServiceId}
                      relayUrl={relayUrl}
                      onManageRelay={onManageRelay}
                      onCredentialChange={onCredentialChange}
                    />
                  ) : null}
                </div>
                <div className="space-y-4">
                  <IntegrationNotificationsCard serviceId={service.credKey} />
                </div>
              </div>
            ) : null}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
