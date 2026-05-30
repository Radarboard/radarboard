"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { useEffect, useState } from "react";
import {
  discoverResolvedRssFeedUrl,
  fetchIntegrationRssFeedOverrides,
  getIntegrationRssFeedMode,
  type IntegrationRssFeedOverrides,
  resolveIntegrationRssFeedUrl,
  saveIntegrationRssFeedOverrides,
} from "@/lib/integration-rss-feeds";

export function IntegrationRssFeedCard({
  serviceId,
  defaultRssFeedUrl,
}: {
  serviceId: string;
  defaultRssFeedUrl?: string;
}) {
  const [state, setState] = useState<{
    overrides: IntegrationRssFeedOverrides;
    loaded: boolean;
    draft: string;
    isSaving: boolean;
    feedback: string | null;
    error: string | null;
  }>({
    overrides: {},
    loaded: false,
    draft: "",
    isSaving: false,
    feedback: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetchIntegrationRssFeedOverrides()
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

  const mode = getIntegrationRssFeedMode(serviceId, state.overrides);
  const effectiveUrl = resolveIntegrationRssFeedUrl(serviceId, state.overrides, defaultRssFeedUrl);

  useEffect(() => {
    if (!state.loaded) return;
    setState((current) => ({ ...current, draft: effectiveUrl ?? "" }));
  }, [effectiveUrl, state.loaded]);

  function setTransientFeedback(message: string) {
    setState((current) => ({ ...current, feedback: message }));
    window.setTimeout(() => {
      setState((current) => ({ ...current, feedback: null }));
    }, 3000);
  }

  async function persist(next: IntegrationRssFeedOverrides) {
    setState((current) => ({ ...current, overrides: next }));
    await saveIntegrationRssFeedOverrides(next);
  }

  async function saveCustomUrl() {
    const value = state.draft.trim();
    if (!value) return;
    if (defaultRssFeedUrl && value === defaultRssFeedUrl.trim()) {
      await resetToSuggested();
      setTransientFeedback("Using suggested feed URL");
      return;
    }

    setState((current) => ({ ...current, isSaving: true, error: null }));
    try {
      const resolvedFeedUrl = await discoverResolvedRssFeedUrl(value);
      await persist({ ...state.overrides, [serviceId]: resolvedFeedUrl });
      setState((current) => ({ ...current, draft: resolvedFeedUrl }));
      setTransientFeedback("Resolved feed URL saved");
    } catch (nextError) {
      setState((current) => ({
        ...current,
        error: nextError instanceof Error ? nextError.message : "Failed to resolve RSS feed",
      }));
    } finally {
      setState((current) => ({ ...current, isSaving: false }));
    }
  }

  async function resetToSuggested() {
    const next = { ...state.overrides };
    delete next[serviceId];
    setState((current) => ({ ...current, error: null }));
    await persist(next);
  }

  async function disableRssFeed() {
    setState((current) => ({ ...current, error: null }));
    await persist({ ...state.overrides, [serviceId]: null });
  }

  return (
    <div className="space-y-4 rounded-item border border-border bg-surface p-4">
      <div>
        <div className="font-mono text-foreground text-w-base">RSS Feed</div>
        <div className="text-dim text-w-sm">
          Paste a website URL or feed URL. Radarboard resolves and stores the XML feed URL.
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="rss-feed-url">URL</Label>
        <Input
          id="rss-feed-url"
          type="url"
          value={state.draft}
          onChange={(event) => setState((current) => ({ ...current, draft: event.target.value }))}
          placeholder={defaultRssFeedUrl ?? "https://example.com/blog"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => saveCustomUrl()}
          disabled={!state.draft.trim() || state.isSaving}
          variant="outline-accent"
          uppercase={false}
          size="xs"
        >
          {state.isSaving ? "Resolving..." : "Resolve & Save"}
        </Button>
        <Button
          type="button"
          onClick={() => resetToSuggested()}
          disabled={!state.loaded || !defaultRssFeedUrl || mode === "inherit"}
          variant="outline"
          uppercase={false}
          size="xs"
          className="text-dim hover:bg-muted"
        >
          Use Suggested
        </Button>
        <Button
          type="button"
          onClick={() => disableRssFeed()}
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
            return defaultRssFeedUrl
              ? "Using the integration-suggested RSS feed URL."
              : "No suggested RSS feed URL yet. Save a custom URL to enable one globally.";
          }
          if (mode === "custom") return "Using a custom resolved feed URL.";
          return "RSS feed tracking is disabled globally for this integration.";
        })()}
      </div>

      {state.error ? (
        <div className="font-mono text-destructive text-w-sm">{state.error}</div>
      ) : null}
      {state.feedback ? (
        <div className="font-mono text-success text-w-sm">{state.feedback}</div>
      ) : null}
    </div>
  );
}
