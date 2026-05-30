"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { Button } from "@radarboard/ui/button";
import type { WidgetAuth } from "@radarboard/widget-engine/widgets/registry";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { normalizeOAuthOrigin } from "@/lib/auth/oauth-redirect";
import { handleExternalLinkClick } from "@/lib/system/ui/external-url";
import { CredentialFields } from "../credential-fields";

function resolveOAuthCardState(
  isConnected: boolean,
  clientCredsSaved: boolean
): "connected" | "ready-to-connect" | "no-client-creds" {
  if (isConnected) return "connected";
  if (clientCredsSaved) return "ready-to-connect";
  return "no-client-creds";
}

/**
 * Collect OAuth scopes from ALL widgets that share the same credential key.
 * This ensures the token has sufficient permissions for every widget that needs it.
 */
function toAuthList(auth: WidgetAuth | WidgetAuth[] | undefined): WidgetAuth[] {
  if (!auth) return [];
  return Array.isArray(auth) ? auth : [auth];
}

function collectMergedScopes(credKey: string, fallbackScopes: string[]): string[] {
  const allScopes = new Set<string>(fallbackScopes);

  for (const descriptor of WIDGET_REGISTRY.values()) {
    for (const auth of toAuthList(descriptor.auth)) {
      if (auth.id === credKey && auth.oauth?.scopes) {
        for (const scope of auth.oauth.scopes) allScopes.add(scope);
      }
    }
  }

  return Array.from(allScopes);
}

// --- Clickable URL that copies to clipboard ---

function CopyableUrl({ url }: { url: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const handleCopy = useCallback(async () => {
    try {
      const { copyText } = await import("@/lib/clipboard");
      await copyText(url);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    } finally {
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }, [url]);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        onClick={handleCopy}
        variant="ghost-link"
        uppercase={false}
        aria-label={`Copy ${url}`}
        className="h-auto gap-1 break-all text-left text-accent hover:text-accent"
      >
        <span className="underline underline-offset-2">{url}</span>
        {copyState === "copied" ? (
          <Check className="icon-xs shrink-0 text-success" />
        ) : (
          <Copy className="icon-xs shrink-0" />
        )}
      </Button>
      {copyState === "error" ? (
        <span role="status" className="font-mono text-destructive text-w-sm">
          Copy failed
        </span>
      ) : null}
    </span>
  );
}

/**
 * Renders instruction text, replacing URLs with clickable copy-to-clipboard buttons.
 */
function InstructionText({ text }: { text: string }) {
  const lineCounts = new Map<string, number>();

  return (
    <div className="space-y-2 rounded-item border border-border bg-surface px-3 py-2.5 text-muted-foreground text-w-sm leading-relaxed">
      {text.split("\n").map((line) => {
        const lineOccurrence = (lineCounts.get(line) ?? 0) + 1;
        lineCounts.set(line, lineOccurrence);
        const lineKey = `${line}:${lineOccurrence}`;
        const parts = line.split(/(https?:\/\/[^\s,)]+)/g);
        const partCounts = new Map<string, number>();

        return (
          <div key={lineKey}>
            {parts.map((part) => {
              const partOccurrence = (partCounts.get(part) ?? 0) + 1;
              partCounts.set(part, partOccurrence);
              const partKey = `${lineKey}:${part}:${partOccurrence}`;

              return /^https?:\/\//.test(part) ? (
                <CopyableUrl key={partKey} url={part} />
              ) : (
                <span key={partKey}>{part}</span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// --- Google gws CLI import button ---

function GwsImportButton({ onCredentialChange }: { onCredentialChange: () => void }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch(API_ROUTES.authGwsImport, { method: "POST" });
      const data = (await res.json()) as { imported: boolean; error?: string };
      setResult(data.imported ? "Imported from gws CLI" : (data.error ?? "Import failed"));
      if (data.imported) onCredentialChange();
    } catch {
      setResult("Import failed");
    } finally {
      setImporting(false);
      setTimeout(() => setResult(null), 5000);
    }
  }, [onCredentialChange]);

  return (
    <>
      <Button
        type="button"
        onClick={handleImport}
        disabled={importing}
        variant="outline"
        uppercase={false}
        fullWidth
        className="text-dim hover:text-muted-foreground"
      >
        {importing ? "Importing..." : "Or import from gws CLI"}
      </Button>
      {Boolean(result) && <div className="font-mono text-success text-w-sm">{result}</div>}
    </>
  );
}

// --- OAuth "Ready to connect" state ---

function OAuthConnectState({
  credKey,
  service,
  onEditCreds,
  onCredentialChange,
  showNextStep,
}: {
  credKey: string;
  service: WidgetAuth;
  onEditCreds: () => void;
  onCredentialChange: () => void;
  showNextStep?: boolean;
}) {
  const isGoogle = service.oauth?.provider === "google";

  const mergedScopes = useMemo(
    () => collectMergedScopes(credKey, service.oauth?.scopes ?? []),
    [credKey, service.oauth?.scopes]
  );

  const handleConnect = useCallback(() => {
    const origin = window.location.origin;
    const scopes = mergedScopes.join(" ");
    window.location.href = `${origin}/api/auth/${service.oauth?.provider}/redirect?credKey=${encodeURIComponent(credKey)}&scopes=${encodeURIComponent(scopes)}`;
  }, [credKey, mergedScopes, service.oauth?.provider]);

  return (
    <div className="space-y-2">
      {showNextStep ? (
        <div
          role="status"
          className="rounded-item border border-success/20 bg-surface px-3 py-2 text-success text-w-sm"
        >
          Credentials saved. Click Connect with {service.name} to complete authorization.
        </div>
      ) : null}
      <Button
        type="button"
        onClick={handleConnect}
        variant="secondary"
        size="lg"
        uppercase={false}
        fullWidth
      >
        Connect with {service.name}
      </Button>
      {isGoogle && <GwsImportButton onCredentialChange={onCredentialChange} />}
      <Button
        type="button"
        onClick={onEditCreds}
        variant="ghost-link"
        uppercase={false}
        className="text-dim text-w-sm hover:text-dim"
      >
        Edit credentials
      </Button>
    </div>
  );
}

// --- OAuth "No client creds" form ---

function OAuthNoCredsForm({
  credKey,
  service,
  values,
  setValues,
  instructions,
  allFieldsFilled,
  saving,
  onSave,
  onCredentialChange,
}: {
  credKey: string;
  service: WidgetAuth;
  values: Record<string, string>;
  setValues: Dispatch<SetStateAction<Record<string, string>>>;
  instructions: string | undefined;
  allFieldsFilled: boolean;
  saving: boolean;
  onSave: () => void;
  onCredentialChange: () => void;
}) {
  const isGoogle = service.oauth?.provider === "google";

  return (
    <div className="space-y-3">
      {Boolean(service.docsUrl) && (
        <a
          href={service.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => handleExternalLinkClick(event, service.docsUrl ?? "")}
          className="inline-flex items-center gap-1.5 font-mono text-accent text-w-sm transition-colors hover:text-accent"
        >
          Create your OAuth app
          <ExternalLink className="icon-xs" />
        </a>
      )}

      {Boolean(instructions) && <InstructionText text={instructions!} />}

      <CredentialFields
        credKey={credKey}
        fields={service.fields ?? []}
        values={values}
        onUpdateField={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
      />

      <Button
        type="button"
        onClick={onSave}
        disabled={!allFieldsFilled || saving}
        variant="secondary"
        size="lg"
        uppercase={false}
        fullWidth
      >
        {saving ? "Saving..." : "Save & Continue"}
      </Button>

      {isGoogle && (
        <>
          <div className="text-center text-dim text-w-sm">or</div>
          <GwsImportButton onCredentialChange={onCredentialChange} />
        </>
      )}
    </div>
  );
}

// --- OAuth Service Card ---

interface OAuthServiceCardProps {
  credKey: string;
  service: WidgetAuth;
  isConnected: boolean;
  onCredentialChange: () => void;
}

export function OAuthServiceCard({
  credKey,
  service,
  isConnected,
  onCredentialChange,
}: OAuthServiceCardProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [clientCredsSaved, setClientCredsSaved] = useState(isConnected);
  const [hasOAuthToken, setHasOAuthToken] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_ROUTES.credentials}?key=${encodeURIComponent(credKey)}`);
        const data = (await res.json()) as { values?: Record<string, string> | null };
        const storedValues = data.values ?? null;
        if (cancelled || !storedValues) return;

        const restoredValues = (service.fields ?? []).reduce<Record<string, string>>(
          (acc, field) => {
            const value = storedValues[field.key] ?? "";
            if (value.trim().length > 0) {
              acc[field.key] = value;
            }
            return acc;
          },
          {}
        );

        if (Object.keys(restoredValues).length > 0) {
          setValues((current) => (Object.keys(current).length > 0 ? current : restoredValues));
          setClientCredsSaved(true);
        }

        setHasOAuthToken(Boolean(storedValues.token?.trim() || storedValues.refreshToken?.trim()));
      } catch {
        if (!cancelled) {
          setHasOAuthToken(false);
        }
      }
    })().catch(() => {
      /* fire-and-forget */
    });

    return () => {
      cancelled = true;
    };
  }, [credKey, service.fields]);

  const handleSaveClientCreds = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(API_ROUTES.credentials, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: credKey, values }),
      });
      if (res.ok) {
        setHasOAuthToken(false);
        setClientCredsSaved(true);
        onCredentialChange();
      }
    } finally {
      setSaving(false);
    }
  }, [credKey, values, onCredentialChange]);

  const restoreClientCreds = useCallback(
    (previousValues: Record<string, string> | undefined) => {
      if (!previousValues) return;
      const restored: Record<string, string> = {};
      for (const field of service.fields ?? []) {
        const prev = previousValues[field.key];
        if (prev) restored[field.key] = prev;
      }
      if (Object.keys(restored).length > 0) setValues(restored);
    },
    [service.fields]
  );

  const handleDisconnect = useCallback(async () => {
    const res = await fetch(API_ROUTES.credentials, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: credKey }),
    });
    if (res.ok) {
      const data = (await res.json()) as { previousValues?: Record<string, string> };
      restoreClientCreds(data.previousValues);
      setHasOAuthToken(false);
      setClientCredsSaved(false);
      onCredentialChange();
    }
  }, [credKey, restoreClientCreds, onCredentialChange]);

  const allFieldsFilled = service.fields?.every((f) => values[f.key]?.trim()) ?? false;
  const _isGoogle = service.oauth?.provider === "google";

  const rawOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const instructionOrigin =
    service.oauth?.normalizeOrigin === true ? normalizeOAuthOrigin(rawOrigin) : rawOrigin;
  const instructions = service.oauth?.setupInstructions?.replaceAll("{origin}", instructionOrigin);

  const cardState = resolveOAuthCardState(hasOAuthToken, clientCredsSaved);

  return (
    <div className="space-y-3">
      {cardState === "connected" && (
        <div className="space-y-2">
          <OAuthConnectState
            credKey={credKey}
            service={service}
            onEditCreds={handleDisconnect}
            onCredentialChange={onCredentialChange}
          />
          <Button
            type="button"
            onClick={handleDisconnect}
            variant="ghost-link"
            uppercase={false}
            className="text-dim text-w-sm hover:text-destructive"
          >
            Disconnect
          </Button>
        </div>
      )}

      {cardState === "ready-to-connect" && (
        <OAuthConnectState
          credKey={credKey}
          service={service}
          onEditCreds={() => setClientCredsSaved(false)}
          onCredentialChange={onCredentialChange}
          showNextStep
        />
      )}

      {cardState === "no-client-creds" && service.fields && (
        <OAuthNoCredsForm
          credKey={credKey}
          service={service}
          values={values}
          setValues={setValues}
          instructions={instructions}
          allFieldsFilled={allFieldsFilled}
          saving={saving}
          onSave={handleSaveClientCreds}
          onCredentialChange={onCredentialChange}
        />
      )}
    </div>
  );
}
