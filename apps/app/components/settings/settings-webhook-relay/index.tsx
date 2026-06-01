"use client";

import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { useMemo, useState } from "react";
import { SettingsPanel } from "../settings-page-layout";

export function normalizeRelayUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

interface RelaySettingsPanelProps {
  relayUrl: string;
  onSaveRelayUrl: (url: string) => void;
  serviceLabels: string[];
}

export function RelaySettingsPanel({
  relayUrl,
  onSaveRelayUrl,
  serviceLabels,
}: RelaySettingsPanelProps) {
  return (
    <RelaySettingsPanelForm
      key={relayUrl}
      relayUrl={relayUrl}
      onSaveRelayUrl={onSaveRelayUrl}
      serviceLabels={serviceLabels}
    />
  );
}

function RelaySettingsPanelForm({
  relayUrl,
  onSaveRelayUrl,
  serviceLabels,
}: RelaySettingsPanelProps) {
  const [draftState, setDraftState] = useState({ hasEdited: false, value: "" });
  const draft = draftState.hasEdited ? draftState.value : relayUrl;

  const normalizedDraft = useMemo(() => normalizeRelayUrl(draft), [draft]);
  const normalizedRelayUrl = useMemo(() => normalizeRelayUrl(relayUrl), [relayUrl]);
  const hasRelayUrl = normalizedRelayUrl.length > 0;
  const canSave = normalizedDraft !== normalizedRelayUrl;

  function handleSave() {
    onSaveRelayUrl(normalizedDraft);
  }

  function handleClear() {
    onSaveRelayUrl("");
  }

  return (
    <SettingsPanel
      title="Webhook Relay"
      description="Manage the shared base URL used to generate provider-specific webhook endpoints."
    >
      <div className="space-y-3">
        <div className="rounded-item border border-border bg-surface px-3 py-2">
          <p className="text-dim text-w-sm leading-relaxed">
            Set the public relay base URL once. Webhook-capable integrations derive their exact
            endpoint from this value, while provider-specific signing secrets stay in each
            integration modal.
          </p>
        </div>

        <div className="space-y-3 border border-border bg-surface px-3 py-3">
          <div className="space-y-1">
            <Label htmlFor="relay-url">Relay URL</Label>
            <div className="text-dim text-w-sm">
              Your deployed relay URL for inbound provider webhooks.
            </div>
          </div>

          <Input
            id="relay-url"
            type="text"
            value={draft}
            onChange={(event) => setDraftState({ hasEdited: true, value: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSave) {
                handleSave();
              }
            }}
            placeholder="https://your-relay.example.com"
            className="h-9"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={!canSave}
              className="uppercase-none h-auto border-accent/20 px-3 py-1.5 font-mono text-accent text-w-sm hover:bg-accent/10 hover:text-accent disabled:opacity-40"
            >
              Save Relay URL
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={!hasRelayUrl}
              className="uppercase-none h-auto border-destructive/20 px-3 py-1.5 font-mono text-destructive text-w-sm hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            >
              Clear
            </Button>
            {hasRelayUrl ? (
              <span className="font-mono text-dim text-w-sm">Current: {normalizedRelayUrl}</span>
            ) : (
              <span className="font-mono text-dim text-w-sm">No relay URL configured yet</span>
            )}
          </div>
        </div>

        <div className="rounded-item border border-border border-dashed bg-secondary/30 px-3 py-2">
          <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Used By</div>
          <p className="mt-2 text-dim text-w-sm leading-relaxed">
            {serviceLabels.join(", ")} derive their exact endpoint from this base URL.
          </p>
        </div>
      </div>
    </SettingsPanel>
  );
}

export function RelayUsagePanel({
  relayUrl,
  serviceLabels,
}: {
  relayUrl: string;
  serviceLabels: string[];
}) {
  const normalizedRelayUrl = normalizeRelayUrl(relayUrl);
  const hasRelayUrl = normalizedRelayUrl.length > 0;

  return (
    <SettingsPanel
      title="Webhook Providers"
      description="Global webhook infrastructure context for integrations that receive inbound events."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {serviceLabels.map((label) => (
            <Badge key={label} variant="secondary">
              {label}
            </Badge>
          ))}
        </div>

        <div className="rounded-item border border-border border-dashed bg-muted p-3">
          <p className="text-dim text-w-sm leading-relaxed">
            {hasRelayUrl
              ? `Provider endpoints are currently derived from ${normalizedRelayUrl}.`
              : "Once a relay URL is configured, webhook-capable integrations will generate their exact provider endpoints from it."}
          </p>
        </div>

        <div className="rounded-item border border-border bg-surface p-3">
          <div className="font-mono text-dim text-w-sm uppercase tracking-widest">
            Per-provider setup
          </div>
          <p className="mt-2 text-dim text-w-sm leading-relaxed">
            Provider-specific signing secrets, endpoint copy helpers, and setup docs remain inside
            each integration modal under Webhook Setup.
          </p>
        </div>
      </div>
    </SettingsPanel>
  );
}
