"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { mutate as mutateSWR } from "swr";
import { CredentialFields } from "@/components/credentials/credential-fields";
import type { ServiceEntry } from "@/components/settings/settings-integrations/types";
import {
  hasRequiredCredentialFields,
  pickEditableCredentialValues,
  saveCredentialValues,
} from "@/components/settings/settings-integrations/utils";
import { handleExternalLinkClick } from "@/lib/system/ui/external-url";

export function ApiCredentialAccessCard({
  service,
  credentialKey,
  values,
  setValues,
  onCredentialSaved,
  onCredentialChange,
}: {
  service: ServiceEntry;
  credentialKey: string;
  values: Record<string, string>;
  setValues: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onCredentialSaved?: (payload: {
    credentialKey: string;
    values: Record<string, string>;
  }) => Promise<void> | void;
  onCredentialChange: () => Promise<void> | void;
}) {
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const apiConfigured = hasRequiredCredentialFields(values, service.auth.fields);
  const allFieldsFilled =
    service.auth.fields?.every((field) => field.optional || values[field.key]?.trim()) ?? false;

  const revalidateCredentialData = useCallback(async () => {
    await mutateSWR(
      (key) => typeof key === "string" && key.startsWith("/api/integrations/"),
      undefined,
      { revalidate: true }
    );
  }, []);

  const updateField = useCallback(
    (key: string, value: string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setTestResult(null);
      setSaveResult(null);
    },
    [setValues]
  );

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(API_ROUTES.credentialsTest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: service.credKey, values }),
      });
      const result = (await res.json()) as { ok: boolean; error?: string };
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, error: "Connection test failed" });
    } finally {
      setTesting(false);
    }
  }, [service.credKey, values]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (await saveCredentialValues(credentialKey, values)) {
        await onCredentialSaved?.({ credentialKey, values });
        setSaveResult({ ok: true });
        await onCredentialChange();
        await revalidateCredentialData();
      } else {
        setSaveResult({ ok: false, error: "Failed to save credentials" });
      }
    } finally {
      setSaving(false);
    }
  }, [credentialKey, onCredentialChange, onCredentialSaved, revalidateCredentialData, values]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(API_ROUTES.credentials, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: credentialKey }),
      });
      if (!res.ok) return;

      const data = (await res.json()) as { previousValues?: Record<string, string> };
      setValues(() =>
        pickEditableCredentialValues(data.previousValues ?? null, service.auth.fields)
      );
      setTestResult(null);
      setSaveResult(null);
      await onCredentialChange();
      await revalidateCredentialData();
    } finally {
      setDisconnecting(false);
    }
  }, [credentialKey, onCredentialChange, revalidateCredentialData, service.auth.fields, setValues]);

  return (
    <div className="space-y-3">
      {Boolean(service.auth.docsUrl) && (
        <a
          href={service.auth.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => handleExternalLinkClick(event, service.auth.docsUrl ?? "")}
          className="inline-flex items-center gap-1.5 font-mono text-accent text-w-sm transition-colors hover:text-accent/80"
        >
          Get your credentials
          <ExternalLink className="icon-xs" />
        </a>
      )}

      {service.auth.fields ? (
        <CredentialFields
          credKey={credentialKey}
          fields={service.auth.fields}
          values={values}
          onUpdateField={updateField}
        />
      ) : null}

      {Boolean(testResult) && (
        <div
          className={cn(
            "py-1 font-mono text-w-sm",
            testResult?.ok ? "text-success" : "text-destructive"
          )}
        >
          {testResult?.ok ? "Connection successful" : (testResult?.error ?? "Connection failed")}
        </div>
      )}

      {Boolean(saveResult) && (
        <div
          className={cn(
            "py-1 font-mono text-w-sm",
            saveResult?.ok ? "text-success" : "text-destructive"
          )}
        >
          {saveResult?.ok ? "Credentials saved" : (saveResult?.error ?? "Save failed")}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={!allFieldsFilled || testing}
          uppercase={false}
          size="xs"
          className="font-mono text-dim hover:text-foreground-secondary disabled:opacity-40"
        >
          {testing ? <Loader2 className="icon-xs animate-spin" /> : "Test Connection"}
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!allFieldsFilled || saving}
          uppercase={false}
          size="xs"
          className="font-mono"
        >
          {saving ? <Loader2 className="icon-xs animate-spin" /> : "Save"}
        </Button>
        {apiConfigured ? (
          <Button
            type="button"
            variant="ghost-link"
            onClick={handleDisconnect}
            disabled={disconnecting}
            uppercase={false}
            className="font-mono text-dim text-w-sm hover:text-destructive disabled:opacity-40"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
