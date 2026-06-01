"use client";

import { getIntegration } from "@radarboard/integration-sdk";
import { Badge } from "@radarboard/ui/badge";
import { Label } from "@radarboard/ui/label";
import { cn } from "@radarboard/utils/cn";
import { CheckCircle } from "lucide-react";
import { SettingsCatalogCard } from "@/components/settings/settings-catalog-card";
import type { ServiceEntry } from "@/components/settings/settings-integrations/types";
import { RemoteServiceIcon } from "@/components/shared/remote-service-icon";
import { getServiceFaviconUrl } from "@/lib/service-favicons";

const SERVICE_CARD_ICON_SIZE = 28;
const SELECTABLE_SERVICE_ICON_SIZE = 28;

function ServiceIconFallback() {
  return <span className="inline-block h-full w-full rounded-item border border-border bg-muted" />;
}

function getStatusText({
  apiConfigured,
  connectionCount,
  mcpReady,
}: {
  apiConfigured: boolean;
  connectionCount: number;
  mcpReady: boolean;
}) {
  if (connectionCount > 0) {
    return `${connectionCount} ${connectionCount === 1 ? "connection" : "connections"}`;
  }

  if (apiConfigured && mcpReady) return "API + MCP configured";
  if (apiConfigured) return "API configured";
  if (mcpReady) return "MCP configured";

  return "Not configured";
}

function ReadinessBadges({
  apiConfigured,
  mcpReady,
}: {
  apiConfigured: boolean;
  mcpReady: boolean;
}) {
  if (!apiConfigured && !mcpReady) return null;

  return (
    <>
      {apiConfigured ? <Badge variant="success">API</Badge> : null}
      {mcpReady ? <Badge variant="secondary">MCP</Badge> : null}
    </>
  );
}

export function ServiceCard({
  service,
  connectionCount,
  apiConfigured,
  mcpReady,
  onClick,
}: {
  service: ServiceEntry;
  connectionCount: number;
  apiConfigured: boolean;
  mcpReady: boolean;
  onClick: () => void;
}) {
  const faviconUrl = getServiceFaviconUrl(service.homepage ?? service.auth.docsUrl, 32);
  const isConfigured = apiConfigured || mcpReady;
  const statusText = getStatusText({ apiConfigured, connectionCount, mcpReady });

  return (
    <SettingsCatalogCard
      enabled={isConfigured}
      title={service.auth.name ?? service.credKey}
      description={service.description}
      status={
        <div className="truncate font-mono text-muted-foreground text-w-sm">{statusText}</div>
      }
      badges={<ReadinessBadges apiConfigured={apiConfigured} mcpReady={mcpReady} />}
      onOpen={onClick}
      openAriaLabel={`Configure ${service.auth.name ?? service.credKey}`}
      icon={
        <div className="relative">
          <RemoteServiceIcon
            src={faviconUrl}
            alt=""
            size={SERVICE_CARD_ICON_SIZE}
            className="rounded-item"
            fallback={<ServiceIconFallback />}
          />
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-raised",
              isConfigured ? "bg-success" : "bg-dim"
            )}
          />
        </div>
      }
    />
  );
}

/** Selectable variant for onboarding — checkbox card with the same visual style. */
export function SelectableServiceCard({
  service,
  selected,
  onToggle,
}: {
  service: ServiceEntry;
  selected: boolean;
  onToggle: () => void;
}) {
  const faviconUrl = getServiceFaviconUrl(service.homepage ?? service.auth.docsUrl, 32);
  const inputId = `service-select-${service.credKey}`;
  const descriptor =
    (service.descriptorId ? getIntegration(service.descriptorId) : undefined) ??
    getIntegration(service.credKey) ??
    (service.integrationKey ? getIntegration(service.integrationKey) : undefined);

  return (
    <Label
      htmlFor={inputId}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-item border px-3 py-2.5 text-left font-sans normal-case tracking-normal transition-colors",
        selected ? "border-accent/30 bg-accent/10" : "border-border bg-surface hover:bg-muted"
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="sr-only"
      />
      <div className="relative shrink-0">
        <RemoteServiceIcon
          src={faviconUrl}
          alt=""
          size={SELECTABLE_SERVICE_ICON_SIZE}
          className="rounded-item"
          fallback={<ServiceIconFallback />}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground text-w-base">
            {service.auth.name ?? service.credKey}
          </span>
          {selected ? <CheckCircle className="ml-auto h-4 w-4 shrink-0 text-accent" /> : null}
        </div>
        {descriptor?.description || service.description ? (
          <div className="mt-1 text-foreground-secondary text-w-sm leading-snug">
            {descriptor?.description ?? service.description}
          </div>
        ) : null}
      </div>
    </Label>
  );
}
