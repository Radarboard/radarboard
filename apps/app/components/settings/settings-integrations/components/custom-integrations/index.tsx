"use client";

import { ConfirmationDialog } from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Plug } from "lucide-react";
import { useState } from "react";
import {
  type UserIntegrationSummary,
  useUserIntegrations,
} from "@/hooks/settings/use-user-integrations";
import { SettingsCardSection } from "../../../settings-page-layout";

/**
 * Lists the no-code REST integrations the user created (via the assistant or
 * MCP) and lets them remove one. Rendered inside SettingsIntegrations. When
 * there are none it still shows an empty-state hint so users discover that the
 * assistant can wire up any REST API — otherwise the capability is invisible.
 */
export function CustomIntegrationsSection() {
  const { integrations, loading, remove } = useUserIntegrations();
  const [pendingRemoval, setPendingRemoval] = useState<UserIntegrationSummary | null>(null);

  // Wait for the first load so the empty-state doesn't flash before data arrives.
  if (loading) return null;

  const hasIntegrations = integrations.length > 0;

  return (
    <SettingsCardSection
      title="Custom integrations"
      badge={
        hasIntegrations ? (
          <span className="rounded-item border border-border bg-card px-2 py-0.5 font-mono text-muted-foreground text-w-sm">
            {integrations.length} created
          </span>
        ) : undefined
      }
    >
      {hasIntegrations ? (
        <ul className="flex flex-col gap-2">
          {integrations.map((integration) => {
            const actionCount = integration.dataSourceActions.length;
            return (
              <li
                key={integration.id}
                className="flex items-center justify-between gap-3 rounded-item border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground text-w-sm">
                    {integration.name}
                  </p>
                  <p className="truncate font-mono text-muted-foreground text-w-xs">
                    {integration.baseUrl} · {actionCount} action{actionCount === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  uppercase={false}
                  className="shrink-0"
                  onClick={() => setPendingRemoval(integration)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={Plug}
          title="No custom integrations yet"
          message={
            <>
              Ask the assistant to connect any REST API — for example,{" "}
              <span className="text-foreground-secondary">
                "Add the CoinGecko API and show the BTC price."
              </span>
            </>
          }
        />
      )}

      <ConfirmationDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title={`Remove ${pendingRemoval?.name ?? "integration"}?`}
        confirmLabel="Remove"
        successToast={`Removed ${pendingRemoval?.name ?? "integration"}`}
        errorToast="Couldn't remove integration"
        onConfirm={async () => {
          if (pendingRemoval) await remove(pendingRemoval.id);
        }}
      >
        This deletes the integration and its dashboard widget — any tiles using it will stop showing
        data. Stored credentials are left untouched.
      </ConfirmationDialog>
    </SettingsCardSection>
  );
}
