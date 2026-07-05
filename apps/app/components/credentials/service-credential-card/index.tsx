"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import type { WidgetAuth } from "@radarboard/widget-engine/widgets/registry";
import { ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { handleExternalLinkClick } from "@/lib/system/ui/external-url";
import { CredentialFields } from "../credential-fields";

interface ServiceCredentialCardProps {
  credKey: string;
  service: WidgetAuth;
  isConnected: boolean;
  onCredentialChange: () => void;
}

export function ServiceCredentialCard({
  credKey,
  service,
  isConnected,
  onCredentialChange,
}: ServiceCredentialCardProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const updateField = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(API_ROUTES.credentialsTest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: credKey, values }),
      });
      const result = (await res.json()) as { ok: boolean; error?: string };
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, error: "Connection test failed" });
    } finally {
      setTesting(false);
    }
  }, [credKey, values]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(API_ROUTES.credentials, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: credKey, values }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      onCredentialChange();
      setValues({});
      toast.success("Credentials saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save credentials");
    } finally {
      setSaving(false);
    }
  }, [credKey, values, onCredentialChange]);

  const handleDisconnect = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.credentials, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: credKey }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Disconnect failed (${res.status})`);
      }
      // Pre-populate fields with previous values so user can easily reconnect
      const data = (await res.json()) as { previousValues?: Record<string, string> };
      if (data.previousValues) {
        setValues(data.previousValues);
      }
      onCredentialChange();
      toast.success("Disconnected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't disconnect");
    }
  }, [credKey, onCredentialChange]);

  const allFieldsFilled =
    service.fields?.every((field) => field.optional || values[field.key]?.trim()) ?? false;

  return (
    <div className="space-y-3">
      {/* Connected: show disconnect */}
      {Boolean(isConnected) && (
        <Button
          type="button"
          onClick={handleDisconnect}
          variant="ghost-link"
          uppercase={false}
          className="text-dim text-w-sm hover:text-destructive"
        >
          Disconnect
        </Button>
      )}

      {/* Disconnected: show fields */}
      {!isConnected && service.fields && (
        <div className="space-y-3">
          {/* Docs link first */}
          {Boolean(service.docsUrl) && (
            <a
              href={service.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => handleExternalLinkClick(event, service.docsUrl ?? "")}
              className="inline-flex items-center gap-1.5 font-mono text-accent text-w-sm transition-colors hover:text-accent/80"
            >
              Get your credentials
              <ExternalLink className="icon-xs" />
            </a>
          )}

          {/* Credential fields */}
          <CredentialFields
            credKey={credKey}
            fields={service.fields}
            values={values}
            onUpdateField={updateField}
          />

          {/* Test result */}
          {Boolean(testResult) && (
            <div
              className={cn(
                "py-1 font-mono text-w-sm",
                testResult?.ok ? "text-success" : "text-destructive"
              )}
            >
              {testResult?.ok
                ? "Connection successful"
                : (testResult?.error ?? "Connection failed")}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              onClick={handleTest}
              disabled={!allFieldsFilled || testing}
              variant="outline"
              size="sm"
              uppercase={false}
              className="text-dim hover:text-foreground-secondary"
            >
              {testing ? <Loader2 className="icon-xs animate-spin" /> : "Test Connection"}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!allFieldsFilled || saving}
              variant="secondary"
              size="sm"
              uppercase={false}
              className="text-foreground-secondary"
            >
              {saving ? <Loader2 className="icon-xs animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
