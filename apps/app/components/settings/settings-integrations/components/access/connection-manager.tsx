"use client";

import type { IntegrationConnection } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { Switch } from "@radarboard/ui/switch";
import { cn } from "@radarboard/utils/cn";
import { useCallback, useEffect, useState } from "react";
import type { IntegrationProviderDefinition } from "@/hooks/settings/use-integration-connections";

export function ProviderConnectionManagerCard({
  provider,
  connections,
  selectedConnectionId,
  onSelectConnection,
  onCreateConnection,
  onSaveConnection,
  onDeleteConnection,
}: {
  provider: IntegrationProviderDefinition | undefined;
  connections: IntegrationConnection[];
  selectedConnectionId: string | null;
  onSelectConnection: (id: string) => void;
  onCreateConnection: () => void;
  onSaveConnection: (connection: IntegrationConnection) => Promise<void>;
  onDeleteConnection: (connection: IntegrationConnection) => Promise<void>;
}) {
  const selectedConnection =
    connections.find((connection) => connection.id === selectedConnectionId) ?? null;
  const [draftName, setDraftName] = useState(selectedConnection?.name ?? "");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    setDraftName(selectedConnection?.name ?? "");
  }, [selectedConnection?.name]);

  const saveSelectedConnection = useCallback(async () => {
    if (!selectedConnection) return;
    setSavingId(selectedConnection.id);
    try {
      await onSaveConnection({
        ...selectedConnection,
        name: draftName.trim() || selectedConnection.name,
      });
    } finally {
      setSavingId(null);
    }
  }, [draftName, onSaveConnection, selectedConnection]);

  const toggleCapability = useCallback(
    async (capabilityId: string, enabled: boolean) => {
      if (!selectedConnection) return;
      setSavingId(selectedConnection.id);
      try {
        await onSaveConnection({
          ...selectedConnection,
          capabilities: selectedConnection.capabilities.map((capability) =>
            capability.id === capabilityId ? { ...capability, enabled } : capability
          ),
        });
      } finally {
        setSavingId(null);
      }
    },
    [onSaveConnection, selectedConnection]
  );

  const makeDefault = useCallback(async () => {
    if (!selectedConnection || selectedConnection.isDefault) return;
    setSavingId(selectedConnection.id);
    try {
      await onSaveConnection({ ...selectedConnection, isDefault: true });
    } finally {
      setSavingId(null);
    }
  }, [onSaveConnection, selectedConnection]);

  const removeSelectedConnection = useCallback(async () => {
    if (!selectedConnection || selectedConnection.source !== "explicit") return;
    setRemovingId(selectedConnection.id);
    try {
      await onDeleteConnection(selectedConnection);
    } finally {
      setRemovingId(null);
    }
  }, [onDeleteConnection, selectedConnection]);

  return (
    <div className="space-y-4 border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
            Connections
          </div>
          <div className="mt-1 text-foreground-secondary text-w-base">
            Optional profiles for assistant access. {connections.length} configured.
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onCreateConnection}
          uppercase={false}
          size="xs"
          className="font-mono text-foreground-secondary hover:text-foreground"
        >
          Add connection
        </Button>
      </div>

      <div className="space-y-px border border-border bg-border">
        {connections.map((connection) => {
          const active = connection.id === selectedConnectionId;
          return (
            <Button
              key={connection.id}
              type="button"
              variant="ghost"
              onClick={() => onSelectConnection(connection.id)}
              uppercase={false}
              spacing="none"
              rounded-item="none"
              className={cn(
                "w-full justify-start bg-surface px-3 py-2 text-left font-sans transition-colors",
                active && "bg-surface-raised",
                !active && "hover:bg-surface-raised"
              )}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground text-w-base">
                    {connection.name}
                  </div>
                  <div className="mt-1 font-mono text-dim text-w-sm">
                    {connection.credentialKey}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {connection.isDefault ? (
                    <span className="border border-border px-2 py-0.5 font-mono text-dim text-w-sm">
                      Default
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "border border-border px-2 py-0.5 font-mono text-w-sm",
                      connection.enabled ? "text-success" : "text-dim"
                    )}
                  >
                    {connection.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </Button>
          );
        })}
      </div>

      {selectedConnection ? (
        <div className="space-y-3 border border-border bg-surface-raised p-4">
          <div className="space-y-1">
            <Label htmlFor="connection-name">Connection Name</Label>
            <Input
              id="connection-name"
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              size="lg"
            />
          </div>

          <div className="space-y-2">
            <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
              Capabilities
            </div>
            <div className="grid gap-px border border-border bg-border">
              {(provider?.capabilities ?? selectedConnection.capabilities).map((capability) => {
                const selectedCapability =
                  selectedConnection.capabilities.find((entry) => entry.id === capability.id) ??
                  capability;
                return (
                  <div
                    key={capability.id}
                    className="flex items-center justify-between bg-surface px-3 py-2"
                  >
                    <div className="font-mono text-foreground-secondary text-w-sm">
                      {capability.id}
                    </div>
                    <Switch
                      checked={selectedCapability.enabled}
                      onCheckedChange={(checked) => toggleCapability(capability.id, checked)}
                      aria-label={`Toggle ${capability.id} for ${selectedConnection.name}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => saveSelectedConnection()}
              disabled={!draftName.trim() || savingId === selectedConnection.id}
              uppercase={false}
              size="xs"
              className="font-mono text-foreground-secondary hover:text-foreground disabled:opacity-40"
            >
              {savingId === selectedConnection.id ? "Saving..." : "Save Connection"}
            </Button>
            {!selectedConnection.isDefault ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => makeDefault()}
                disabled={savingId === selectedConnection.id}
                uppercase={false}
                size="xs"
                className="font-mono text-dim hover:text-foreground disabled:opacity-40"
              >
                Set Default
              </Button>
            ) : null}
            {selectedConnection.source === "explicit" ? (
              <Button
                type="button"
                variant="outline-destructive"
                onClick={() => removeSelectedConnection()}
                disabled={removingId === selectedConnection.id}
                uppercase={false}
                size="xs"
                className="font-mono disabled:opacity-40"
              >
                {removingId === selectedConnection.id ? "Removing..." : "Remove"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
