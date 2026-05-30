"use client";

import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { cn } from "@radarboard/utils/cn";
import { formatDateTime } from "@radarboard/utils/format-date-time";
import { Check, Copy, ExternalLink, Eye, EyeOff, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  GITHUB_STAR_TRACKING_COLLAPSE_THRESHOLD,
  GITHUB_STAR_TRACKING_VISIBLE_COUNT,
  WEBHOOK_SERVICE_CONFIG,
} from "@/components/settings/settings-integrations/constants";
import type {
  GitHubStarTrackingRepoState,
  WebhookServiceId,
} from "@/components/settings/settings-integrations/types";
import {
  buildWebhookEndpoint,
  copyToClipboard,
  deleteCredentialValues,
  fetchCredentialValues,
  normalizeRelayUrl,
  saveCredentialValues,
} from "@/components/settings/settings-integrations/utils";
import { generateSecret } from "@/lib/generate-secret";
import { handleExternalLinkClick } from "@/lib/system/ui/external-url";

function ModalSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 border border-border bg-surface p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-muted-foreground text-w-sm uppercase tracking-[0.18em]">
            {title}
          </div>
          <div className="mt-1 text-foreground-secondary text-w-base">{description}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function WebhookEndpointSection({
  config,
  endpoint,
  onManageRelay,
  onCopyEndpoint,
  copiedField,
}: {
  config: (typeof WEBHOOK_SERVICE_CONFIG)[WebhookServiceId];
  endpoint: string | null;
  onManageRelay: () => void;
  onCopyEndpoint: () => void;
  copiedField: "endpoint" | "secret" | null;
}) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Endpoint</div>
      {endpoint ? (
        <>
          <div className="break-all rounded-item border border-border bg-surface px-3 py-2 font-mono text-foreground-secondary text-w-sm">
            {endpoint}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCopyEndpoint}
              uppercase={false}
              size="xs"
              className="font-mono text-dim hover:text-foreground-secondary"
            >
              {copiedField === "endpoint" ? (
                <>
                  <Check className="icon-xs" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="icon-xs" />
                  Copy Endpoint
                </>
              )}
            </Button>
            <a
              href={config.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => handleExternalLinkClick(event, config.docsUrl)}
              className="inline-flex items-center gap-1.5 font-mono text-accent text-w-sm transition-colors hover:text-accent/80"
            >
              Setup Docs
              <ExternalLink className="icon-xs" />
            </a>
          </div>
          <p className="text-dim text-w-sm leading-relaxed">
            Add this URL in {config.setupHint}. Use the same signing secret below when creating the
            webhook.
          </p>
        </>
      ) : (
        <div className="space-y-2 rounded-item border border-border border-dashed bg-secondary/30 p-3 text-dim text-w-sm leading-relaxed">
          <p>
            Configure the shared relay URL in Settings → Infrastructure before this endpoint can be
            generated.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onManageRelay}
            uppercase={false}
            size="xs"
            className="font-mono text-dim hover:text-foreground-secondary"
          >
            Open Infrastructure Settings
          </Button>
        </div>
      )}
    </div>
  );
}

function WebhookSecretSection({
  copiedField,
  canSaveSecret,
  draftSecret,
  feedback,
  hasStoredSecret,
  isLoadingSecret,
  isRemovingSecret,
  isSavingSecret,
  isSecretVisible,
  onGenerateSecret,
  onCopySecret,
  onRemoveSecret,
  onSaveSecret,
  setDraftSecret,
  setIsSecretVisible,
  secretEnvVar,
}: {
  copiedField: "endpoint" | "secret" | null;
  canSaveSecret: boolean;
  draftSecret: string;
  feedback: string | null;
  hasStoredSecret: boolean;
  isLoadingSecret: boolean;
  isRemovingSecret: boolean;
  isSavingSecret: boolean;
  isSecretVisible: boolean;
  onGenerateSecret: () => void;
  onCopySecret: () => void;
  onRemoveSecret: () => void;
  onSaveSecret: () => void;
  setDraftSecret: (value: string) => void;
  setIsSecretVisible: (value: boolean | ((value: boolean) => boolean)) => void;
  secretEnvVar: string;
}) {
  const trimmedDraftSecret = draftSecret.trim();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="webhook-secret">Signing Secret</Label>
        <Button
          type="button"
          variant="ghost-link"
          onClick={() => setIsSecretVisible((value) => !value)}
          uppercase={false}
          className="inline-flex items-center gap-1 font-mono text-w-sm transition-colors"
          aria-label={isSecretVisible ? "Hide webhook secret" : "Show webhook secret"}
        >
          {isSecretVisible ? <EyeOff className="icon-xs" /> : <Eye className="icon-xs" />}
          {isSecretVisible ? "Hide" : "Reveal"}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          id="webhook-secret"
          type={isSecretVisible ? "text" : "password"}
          value={draftSecret}
          onChange={(event) => setDraftSecret(event.target.value)}
          placeholder={isLoadingSecret ? "Loading secret..." : "Enter signing secret"}
          disabled={isLoadingSecret}
          size="lg"
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={onCopySecret}
          disabled={!trimmedDraftSecret}
          uppercase={false}
          size="lg"
          className="inline-flex shrink-0 items-center gap-1 px-2.5 font-mono text-dim text-w-sm hover:text-foreground-secondary disabled:opacity-40"
        >
          {copiedField === "secret" ? <Check className="icon-xs" /> : <Copy className="icon-xs" />}
          {copiedField === "secret" ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onGenerateSecret}
          uppercase={false}
          size="xs"
          className="inline-flex items-center gap-1.5 border-warning/30 font-mono text-warning hover:bg-warning/10"
        >
          {hasStoredSecret ? "Regenerate" : "Generate"}
        </Button>
        <Button
          type="button"
          onClick={onSaveSecret}
          disabled={!canSaveSecret || isSavingSecret}
          uppercase={false}
          size="xs"
          className="inline-flex items-center gap-1.5 font-mono disabled:opacity-40"
        >
          {isSavingSecret ? <Loader2 className="icon-xs animate-spin" /> : null}
          Save Secret
        </Button>
        <Button
          type="button"
          variant="outline-destructive"
          onClick={onRemoveSecret}
          disabled={!hasStoredSecret || isRemovingSecret}
          uppercase={false}
          size="xs"
          className="inline-flex items-center gap-1.5 font-mono disabled:opacity-40"
        >
          {isRemovingSecret ? <Loader2 className="icon-xs animate-spin" /> : null}
          Remove
        </Button>
      </div>

      <p className="text-dim text-w-sm leading-relaxed">
        Store the secret here so you can copy it while creating the provider webhook. If you use the
        cloud relay, also set the same value on the relay deployment as{" "}
        <span className="font-mono text-muted-foreground">{secretEnvVar}</span>.
      </p>
      {feedback ? <div className="font-mono text-success text-w-sm">{feedback}</div> : null}
    </div>
  );
}

function GitHubStarTrackingSection({ enabled }: { enabled: boolean }) {
  const effectiveLocale = useEffectiveLocale();
  const effectiveTimeZone = useEffectiveTimeZone();
  const [state, setState] = useState<{
    repos: GitHubStarTrackingRepoState[];
    loading: boolean;
    saving: boolean;
    error: string | null;
    feedback: string | null;
    expanded: boolean;
  }>({
    repos: [],
    loading: true,
    saving: false,
    error: null,
    feedback: null,
    expanded: false,
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch(API_ROUTES.githubStarTracking);
      const payload = (await response.json()) as {
        error?: string;
        repos?: GitHubStarTrackingRepoState[];
      };
      if (!response.ok) {
        throw new Error(payload.error ?? `Failed to load tracking state: ${response.status}`);
      }
      setState((current) => ({
        ...current,
        repos: payload.repos ?? [],
        expanded: false,
      }));
    } catch (nextError) {
      setState((current) => ({
        ...current,
        error: nextError instanceof Error ? nextError.message : String(nextError),
      }));
    } finally {
      setState((current) => ({ ...current, loading: false }));
    }
  }, []);

  useEffect(() => {
    load().catch(() => {
      /* fire-and-forget */
    });
  }, [load]);

  const handleStartTracking = useCallback(async () => {
    setState((current) => ({
      ...current,
      saving: true,
      error: null,
      feedback: null,
    }));
    try {
      const response = await fetch(API_ROUTES.githubStarTracking, { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        repos?: GitHubStarTrackingRepoState[];
      };
      if (!response.ok) {
        throw new Error(payload.error ?? `Failed to start tracking: ${response.status}`);
      }
      setState((current) => ({
        ...current,
        repos: payload.repos ?? [],
        expanded: false,
        feedback: "Tracking started for resolved Stars repos.",
      }));
    } catch (nextError) {
      setState((current) => ({
        ...current,
        error: nextError instanceof Error ? nextError.message : String(nextError),
      }));
    } finally {
      setState((current) => ({ ...current, saving: false }));
    }
  }, []);

  const canCollapse = state.repos.length > GITHUB_STAR_TRACKING_COLLAPSE_THRESHOLD;
  const visibleRepos =
    state.expanded || !canCollapse
      ? state.repos
      : state.repos.slice(0, GITHUB_STAR_TRACKING_VISIBLE_COUNT);

  return (
    <div className="space-y-3 rounded-item border border-border bg-secondary/30 p-3">
      <div>
        <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Stars Tracking</div>
        <p className="mt-1 text-dim/60 text-w-sm leading-relaxed">
          Capture a baseline star count for the repos used by the Stars widget. Gross additions only
          become exact after tracking starts and the webhook is live on those repos.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => handleStartTracking()}
          disabled={!enabled || state.saving || state.loading}
          uppercase={false}
          className="h-auto px-2.5 py-1 font-mono text-w-sm disabled:opacity-40"
        >
          {state.saving ? <Loader2 className="icon-xs animate-spin" /> : null}
          Start Tracking
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => load()}
          disabled={state.loading}
          uppercase={false}
          className="h-auto px-2.5 py-1 font-mono text-dim text-w-sm hover:text-foreground-secondary disabled:opacity-40"
        >
          Refresh
        </Button>
      </div>

      {!enabled ? (
        <div className="text-dim/60 text-w-sm">
          Save the webhook secret and configure the relay endpoint first.
        </div>
      ) : null}
      {state.error ? (
        <div className="font-mono text-destructive text-w-sm">{state.error}</div>
      ) : null}
      {state.feedback ? (
        <div className="font-mono text-success text-w-sm">{state.feedback}</div>
      ) : null}

      <div className="space-y-2">
        {!state.loading && state.repos.length > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-item border border-border bg-surface px-3 py-2">
            <div className="font-mono text-dim/60 text-w-sm">
              {state.repos.length} repos resolved for star tracking
            </div>
            {canCollapse ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setState((current) => ({ ...current, expanded: !current.expanded }))}
                uppercase={false}
                className="h-auto px-2 py-1 font-mono text-dim text-w-sm hover:text-foreground-secondary"
              >
                {state.expanded ? "Show less" : `Show all (${state.repos.length})`}
              </Button>
            ) : null}
          </div>
        ) : null}

        {Boolean(state.loading) && (
          <div className="font-mono text-dim text-w-sm">Loading repos…</div>
        )}
        {!state.loading && state.repos.length === 0 && (
          <div className="text-dim text-w-sm">
            No GitHub repos are currently resolved for the Stars widget.
          </div>
        )}
        {!state.loading &&
          state.repos.length > 0 &&
          visibleRepos.map((repo) => (
            <div
              key={repo.repoKey}
              className="flex items-center justify-between gap-3 rounded-item border border-border bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate font-mono text-foreground-secondary text-w-sm">
                  {repo.fullName}
                </div>
                <div className="text-dim text-w-sm">
                  {repo.tracked && repo.trackingStartedAt
                    ? `Tracking since ${
                        formatDateTime(repo.trackingStartedAt * 1000, {
                          locale: effectiveLocale,
                          timeZone: effectiveTimeZone,
                        }) ?? ""
                      }`
                    : "Not tracked yet"}
                </div>
              </div>
              <div
                className={cn(
                  "shrink-0 border border-border px-2 py-0.5 font-mono text-w-sm",
                  repo.tracked ? "text-success" : "text-muted-foreground"
                )}
              >
                {repo.tracked ? "Tracked" : "Idle"}
              </div>
            </div>
          ))}

        {!state.loading && canCollapse && !state.expanded ? (
          <div className="text-dim text-w-sm">
            Showing {visibleRepos.length} of {state.repos.length} repos.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function useWebhookSecretManagerLocal(credentialKey: string, onCredentialChange: () => void) {
  const [storedSecret, setStoredSecret] = useState("");
  const [draftSecret, setDraftSecret] = useState("");
  const [copiedField, setCopiedField] = useState<"endpoint" | "secret" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoadingSecret, setIsLoadingSecret] = useState(true);
  const [isSavingSecret, setIsSavingSecret] = useState(false);
  const [isRemovingSecret, setIsRemovingSecret] = useState(false);
  const [isSecretVisible, setIsSecretVisible] = useState(false);

  const loadSecret = useCallback(async () => {
    setIsLoadingSecret(true);
    try {
      const values = await fetchCredentialValues(credentialKey);
      const nextSecret = values?.secret ?? "";
      setStoredSecret(nextSecret);
      setDraftSecret(nextSecret);
    } catch {
      setStoredSecret("");
      setDraftSecret("");
    } finally {
      setIsLoadingSecret(false);
    }
  }, [credentialKey]);

  useEffect(() => {
    loadSecret().catch(() => {
      /* fire-and-forget */
    });
  }, [loadSecret]);

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 3000);
  }, []);

  const markCopied = useCallback((field: "endpoint" | "secret") => {
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const saveSecret = useCallback(
    async (nextSecret: string) => {
      setIsSavingSecret(true);
      try {
        const didSave = await saveCredentialValues(credentialKey, { secret: nextSecret });
        if (!didSave) throw new Error("Failed to save");
        setStoredSecret(nextSecret);
        setDraftSecret(nextSecret);
        onCredentialChange();
        showFeedback("Secret saved");
      } catch {
        showFeedback("Failed to save secret");
      } finally {
        setIsSavingSecret(false);
      }
    },
    [credentialKey, onCredentialChange, showFeedback]
  );

  const removeSecret = useCallback(
    async (hasStoredSecret: boolean) => {
      if (!hasStoredSecret) return;
      setIsRemovingSecret(true);
      try {
        const didRemove = await deleteCredentialValues(credentialKey);
        if (!didRemove) throw new Error("Failed to remove");
        setStoredSecret("");
        setDraftSecret("");
        setIsSecretVisible(false);
        onCredentialChange();
        showFeedback("Secret removed");
      } catch {
        showFeedback("Failed to remove secret");
      } finally {
        setIsRemovingSecret(false);
      }
    },
    [credentialKey, onCredentialChange, showFeedback]
  );

  const copyField = useCallback(
    async (value: string, field: "endpoint" | "secret") => {
      if (!value.trim()) return;
      await copyToClipboard(value);
      markCopied(field);
    },
    [markCopied]
  );

  return {
    storedSecret,
    draftSecret,
    setDraftSecret,
    copiedField,
    feedback,
    showFeedback,
    isLoadingSecret,
    isSavingSecret,
    isRemovingSecret,
    isSecretVisible,
    setIsSecretVisible,
    copyField,
    removeSecret,
    saveSecret,
  };
}

export function IntegrationWebhookCard({
  serviceId,
  relayUrl,
  onManageRelay,
  onCredentialChange,
}: {
  serviceId: WebhookServiceId;
  relayUrl: string;
  onManageRelay: () => void;
  onCredentialChange: () => void;
}) {
  const config = WEBHOOK_SERVICE_CONFIG[serviceId];
  const credentialKey = `webhook_secret::${serviceId}`;
  const normalizedRelayUrlValue = normalizeRelayUrl(relayUrl);
  const hasRelayUrl = normalizedRelayUrlValue.startsWith("http");
  const endpoint = hasRelayUrl ? buildWebhookEndpoint(normalizedRelayUrlValue, serviceId) : null;
  const secretManager = useWebhookSecretManagerLocal(credentialKey, onCredentialChange);
  const hasStoredSecret = secretManager.storedSecret.trim().length > 0;
  const trimmedDraftSecret = secretManager.draftSecret.trim();
  const canSaveSecret =
    trimmedDraftSecret.length > 0 && trimmedDraftSecret !== secretManager.storedSecret;

  async function handleGenerateSecret() {
    if (hasStoredSecret) {
      const { confirmAction } = await import("@/lib/dialog");
      const confirmed = await confirmAction(
        "Regenerating this secret will invalidate the current provider webhook signature until you update it there too. Generate a new draft secret?",
        "Regenerate Secret"
      );
      if (!confirmed) return;
    }

    secretManager.setDraftSecret(generateSecret());
    secretManager.setIsSecretVisible(true);
    secretManager.showFeedback(
      hasStoredSecret
        ? "New secret generated. Save Secret to rotate it."
        : "Secret generated. Save Secret to use it."
    );
  }

  return (
    <ModalSection
      title="Webhook Setup"
      description={`${config.label} uses the relay endpoint plus the signing secret you set here.`}
    >
      <WebhookEndpointSection
        config={config}
        endpoint={endpoint}
        onManageRelay={onManageRelay}
        onCopyEndpoint={() => secretManager.copyField(endpoint ?? "", "endpoint")}
        copiedField={secretManager.copiedField}
      />
      <WebhookSecretSection
        copiedField={secretManager.copiedField}
        canSaveSecret={canSaveSecret}
        draftSecret={secretManager.draftSecret}
        feedback={secretManager.feedback}
        hasStoredSecret={hasStoredSecret}
        isLoadingSecret={secretManager.isLoadingSecret}
        isRemovingSecret={secretManager.isRemovingSecret}
        isSavingSecret={secretManager.isSavingSecret}
        isSecretVisible={secretManager.isSecretVisible}
        onGenerateSecret={handleGenerateSecret}
        onCopySecret={() => secretManager.copyField(secretManager.draftSecret, "secret")}
        onRemoveSecret={() => secretManager.removeSecret(hasStoredSecret)}
        onSaveSecret={() => secretManager.saveSecret(trimmedDraftSecret)}
        setDraftSecret={secretManager.setDraftSecret}
        setIsSecretVisible={secretManager.setIsSecretVisible}
        secretEnvVar={config.secretEnvVar}
      />
      {serviceId === "github" ? (
        <GitHubStarTrackingSection enabled={Boolean(endpoint) && hasStoredSecret} />
      ) : null}
    </ModalSection>
  );
}
