"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { useEffect, useState } from "react";
import {
  fetchIntegrationStatusPageOverrides,
  getIntegrationStatusPageMode,
  type IntegrationStatusPageOverrides,
  resolveIntegrationStatusPageUrl,
  saveIntegrationStatusPageOverrides,
} from "@/lib/integration-status-pages";

export function IntegrationStatusPageCard({
  integrationKey,
  defaultStatusPageUrl,
}: {
  integrationKey: string;
  defaultStatusPageUrl?: string;
}) {
  const [state, setState] = useState<{
    overrides: IntegrationStatusPageOverrides;
    loaded: boolean;
    draft: string;
  }>({
    overrides: {},
    loaded: false,
    draft: "",
  });

  useEffect(() => {
    let cancelled = false;

    fetchIntegrationStatusPageOverrides()
      .catch(() => {
        /* fire-and-forget */
      })
      .then((next) => {
        if (cancelled || !next) return;
        setState((current) => ({
          ...current,
          overrides: next,
          loaded: true,
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          overrides: {},
          loaded: true,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const mode = getIntegrationStatusPageMode(integrationKey, state.overrides);
  const effectiveUrl = resolveIntegrationStatusPageUrl(
    integrationKey,
    state.overrides,
    defaultStatusPageUrl
  );

  useEffect(() => {
    if (!state.loaded) return;
    setState((current) => ({ ...current, draft: effectiveUrl ?? "" }));
  }, [effectiveUrl, state.loaded]);

  async function persist(next: IntegrationStatusPageOverrides) {
    setState((current) => ({ ...current, overrides: next }));
    await saveIntegrationStatusPageOverrides(next);
  }

  async function saveCustomUrl() {
    const value = state.draft.trim();
    if (!value) return;
    if (defaultStatusPageUrl && value === defaultStatusPageUrl.trim()) {
      await resetToSuggested();
      return;
    }
    await persist({ ...state.overrides, [integrationKey]: value });
  }

  async function resetToSuggested() {
    const next = { ...state.overrides };
    delete next[integrationKey];
    await persist(next);
  }

  async function disableStatusPage() {
    await persist({ ...state.overrides, [integrationKey]: null });
  }

  return (
    <div className="space-y-4 rounded-item border border-border bg-surface p-4">
      <div>
        <div className="font-mono text-foreground text-w-base">Status Page</div>
        <div className="text-dim text-w-sm">
          Provider-level default status page. Project integrations can override this per platform.
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="status-page-url">URL</Label>
        <Input
          id="status-page-url"
          type="url"
          value={state.draft}
          onChange={(event) => setState((current) => ({ ...current, draft: event.target.value }))}
          placeholder={defaultStatusPageUrl ?? "https://status.example.com"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => saveCustomUrl()}
          disabled={!state.draft.trim()}
          variant="outline-accent"
          uppercase={false}
          size="xs"
        >
          Save
        </Button>
        <Button
          type="button"
          onClick={() => resetToSuggested()}
          disabled={!state.loaded || !defaultStatusPageUrl || mode === "inherit"}
          variant="outline"
          uppercase={false}
          size="xs"
          className="text-dim hover:bg-muted"
        >
          Use Suggested
        </Button>
        <Button
          type="button"
          onClick={() => disableStatusPage()}
          disabled={!state.loaded || mode === "disabled"}
          variant="outline-destructive"
          uppercase={false}
          size="xs"
        >
          Disable
        </Button>
      </div>

      <div className="rounded-item border border-border border-dashed bg-muted p-3 text-dim text-w-sm leading-relaxed">
        {(() => {
          if (mode === "inherit") {
            return defaultStatusPageUrl
              ? "Using the integration-suggested status page URL."
              : "No suggested status page URL yet. Save a custom URL to enable one globally.";
          }
          if (mode === "custom") return "Using a custom global override.";
          return "Status page tracking is disabled globally for this integration.";
        })()}
      </div>
    </div>
  );
}
