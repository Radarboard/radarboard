"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { DatabaseProvider } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { cn } from "@radarboard/utils/cn";
import { Download, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { notifyProjectGraphChanged } from "@/hooks/app/use-project-graph-invalidation";
import { reloadSettingsFromServer } from "@/modules/settings/store/settings-store";
import { SettingsPageLayout, SettingsPanel } from "../settings-page-layout";

interface DbStatus {
  provider: DatabaseProvider;
  connected: boolean;
}

interface ImportResponse {
  success?: boolean;
  errors?: string[];
  warnings?: string[];
  restartRecommended?: boolean;
}

async function readResponseError(response: Response, fallback: string) {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as { error?: string; errors?: string[] };
      return body.error ?? body.errors?.[0] ?? fallback;
    }

    const text = await response.text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

async function dbConfigFetcher(url: string): Promise<DbStatus | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as DbStatus;
}

function buildImportMessage(label: string, response: ImportResponse | null) {
  if (!response) return `${label} completed.`;

  const parts = [
    response.errors?.length ? `${label} restored with issues.` : `${label} restored successfully.`,
  ];

  if (response.warnings?.length) {
    parts.push(`${response.warnings.length} warning${response.warnings.length === 1 ? "" : "s"}.`);
  }

  if (response.errors?.length) {
    parts.push(`${response.errors.length} error${response.errors.length === 1 ? "" : "s"}.`);
  }

  if (response.restartRecommended) {
    parts.push("Restart recommended for long-lived sessions.");
  }

  return parts.join(" ");
}

export function SettingsDatabase() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: status, isLoading: loading } = useSWR(API_ROUTES.databaseConfig, dbConfigFetcher);
  const [databaseUi, setDatabaseUi] = useState<{
    configExportError: string | null;
    configImportError: string | null;
    configImporting: boolean;
    configImportResult: string | null;
    fullBackupError: string | null;
    fullImportMode: "replace" | "merge";
    fullImporting: boolean;
    fullImportResult: string | null;
    testResult: { success: boolean; error?: string } | null;
    testing: boolean;
  }>({
    configExportError: null,
    configImportError: null,
    configImporting: false,
    configImportResult: null,
    fullBackupError: null,
    fullImportMode: "replace",
    fullImporting: false,
    fullImportResult: null,
    testResult: null,
    testing: false,
  });

  const {
    configExportError,
    configImportError,
    configImporting,
    configImportResult,
    fullBackupError,
    fullImportMode,
    fullImporting,
    fullImportResult,
    testResult,
    testing,
  } = databaseUi;

  const refreshAfterImport = useCallback(async () => {
    notifyProjectGraphChanged();
    await Promise.allSettled([
      reloadSettingsFromServer(),
      mutate(
        (key) =>
          typeof key === "string" &&
          (key.includes("/api/system/settings") ||
            key.includes("/api/system/credentials") ||
            key.includes("/api/integrations/") ||
            key.includes("/api/plugins/")),
        undefined,
        { revalidate: true }
      ),
    ]);
    router.refresh();
  }, [mutate, router]);

  const handleTestConnection = useCallback(async () => {
    setDatabaseUi((current) => ({ ...current, testing: true, testResult: null }));
    try {
      const res = await fetch(API_ROUTES.databaseTest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: status?.provider }),
      });
      const data = await res.json();
      setDatabaseUi((current) => ({ ...current, testResult: data }));
    } catch {
      setDatabaseUi((current) => ({
        ...current,
        testResult: { success: false, error: "Network error" },
      }));
    } finally {
      setDatabaseUi((current) => ({ ...current, testing: false }));
    }
  }, [status?.provider]);

  const handleFullBackupExport = useCallback(async () => {
    setDatabaseUi((current) => ({ ...current, fullBackupError: null }));
    try {
      const [res, dialog] = await Promise.all([
        fetch(API_ROUTES.databaseExport),
        import("@/lib/dialog"),
      ]);

      if (!res.ok) {
        throw new Error(await readResponseError(res, "Failed to export full backup."));
      }

      const text = await res.text();
      await dialog.saveTextFile(text, {
        defaultName: `radarboard-full-backup-${new Date().toISOString().slice(0, 10)}.json`,
        extensions: ["json"],
        filterName: "JSON Files",
      });
    } catch (error) {
      setDatabaseUi((current) => ({
        ...current,
        fullBackupError: error instanceof Error ? error.message : "Failed to export full backup.",
      }));
    }
  }, []);

  const handleFullBackupImport = useCallback(async () => {
    setDatabaseUi((current) => ({
      ...current,
      fullImporting: true,
      fullImportResult: null,
      fullBackupError: null,
    }));

    try {
      const { openTextFile } = await import("@/lib/dialog");
      const text = await openTextFile({ extensions: ["json"], filterName: "JSON Files" });
      if (!text) {
        setDatabaseUi((current) => ({ ...current, fullImporting: false }));
        return;
      }

      const backup = JSON.parse(text);
      const res = await fetch(API_ROUTES.databaseImport, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: fullImportMode, backup }),
      });
      const body = (await res.json().catch(() => null)) as ImportResponse | null;

      if (!res.ok) {
        setDatabaseUi((current) => ({
          ...current,
          fullImportResult: body?.errors?.[0] ?? "Full backup import failed.",
        }));
        return;
      }

      await refreshAfterImport();
      setDatabaseUi((current) => ({
        ...current,
        fullImportResult: buildImportMessage("Full backup", body),
      }));
    } catch {
      setDatabaseUi((current) => ({
        ...current,
        fullImportResult: "Invalid full backup file.",
      }));
    } finally {
      setDatabaseUi((current) => ({ ...current, fullImporting: false }));
    }
  }, [fullImportMode, refreshAfterImport]);

  const handleConfigExport = useCallback(async () => {
    setDatabaseUi((current) => ({ ...current, configExportError: null }));
    try {
      const [res, dialog] = await Promise.all([
        fetch(API_ROUTES.configExport),
        import("@/lib/dialog"),
      ]);
      if (!res.ok) {
        throw new Error(await readResponseError(res, "Failed to export config."));
      }
      const text = await res.text();
      await dialog.saveTextFile(text, {
        defaultName: `radarboard-config-${new Date().toISOString().slice(0, 10)}.json`,
        extensions: ["json"],
        filterName: "JSON Files",
      });
    } catch (error) {
      setDatabaseUi((current) => ({
        ...current,
        configExportError: error instanceof Error ? error.message : "Failed to export config.",
      }));
    }
  }, []);

  const handleConfigImport = useCallback(async () => {
    setDatabaseUi((current) => ({
      ...current,
      configImportError: null,
      configImporting: true,
      configImportResult: null,
    }));

    try {
      const { openTextFile } = await import("@/lib/dialog");
      const text = await openTextFile({ extensions: ["json"], filterName: "JSON Files" });
      if (!text) {
        setDatabaseUi((current) => ({ ...current, configImporting: false }));
        return;
      }

      const snapshot = JSON.parse(text);
      const res = await fetch(API_ROUTES.configImport, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const body = (await res.json().catch(() => null)) as ImportResponse | null;

      if (!res.ok) {
        setDatabaseUi((current) => ({
          ...current,
          configImportError: body?.errors?.[0] ?? "Config import failed.",
        }));
        return;
      }

      await refreshAfterImport();
      setDatabaseUi((current) => ({
        ...current,
        configImportResult: buildImportMessage("Config snapshot", body),
      }));
    } catch {
      setDatabaseUi((current) => ({
        ...current,
        configImportError: "Invalid config snapshot file.",
      }));
    } finally {
      setDatabaseUi((current) => ({ ...current, configImporting: false }));
    }
  }, [refreshAfterImport]);

  const providerLabel = status?.provider
    ? status.provider.charAt(0).toUpperCase() + status.provider.slice(1)
    : "Unknown";
  const statusText = loading
    ? "Loading database status…"
    : `${providerLabel} ${status?.connected ? "connected" : "not connected"}`;

  return (
    <SettingsPageLayout
      title="Database"
      description="Make a portable backup of your Radarboard instance or restore it on another instance."
      statusText={statusText}
      statusColor={status?.connected ? "green" : "muted"}
      showSearch={false}
    >
      <div className="max-w-[820px] space-y-5">
        <SettingsPanel
          title="Database"
          description="Radarboard currently uses the configured local provider. To switch providers, rerun the setup flow."
        >
          {loading ? (
            <EmptyState message="Loading database status…" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    status?.connected ? "bg-success" : "bg-muted"
                  )}
                />
                <span className="font-mono text-foreground-secondary text-w-sm">
                  {providerLabel}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing}
                  uppercase={false}
                >
                  {testing ? "Testing..." : "Test Connection"}
                </Button>
                {Boolean(testResult) && (
                  <span
                    className={cn(
                      "font-mono text-xs",
                      testResult?.success ? "text-success" : "text-destructive"
                    )}
                  >
                    {testResult?.success ? "Connected" : (testResult?.error ?? "Failed")}
                  </span>
                )}
              </div>
            </div>
          )}
        </SettingsPanel>

        <SettingsPanel
          title="Full Backup"
          description="Export one file you can restore on another Radarboard instance. Full backups include credentials, settings, plugin data, cache entries, and portable local history."
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button size="sm" uppercase={false} onClick={handleFullBackupExport}>
                <Download className="icon-xs" />
                Export Full Backup
              </Button>

              <Button
                size="sm"
                uppercase={false}
                variant="secondary"
                onClick={() => {
                  handleFullBackupImport().catch(() => undefined);
                }}
                disabled={fullImporting}
              >
                <Upload className="icon-xs" />
                {fullImporting ? "Restoring..." : "Restore Backup"}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-dim text-xs uppercase tracking-wider">Import Mode</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  uppercase={false}
                  variant={fullImportMode === "replace" ? "secondary" : "outline"}
                  onClick={() =>
                    setDatabaseUi((current) => ({ ...current, fullImportMode: "replace" }))
                  }
                >
                  Replace existing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  uppercase={false}
                  variant={fullImportMode === "merge" ? "secondary" : "outline"}
                  onClick={() =>
                    setDatabaseUi((current) => ({ ...current, fullImportMode: "merge" }))
                  }
                >
                  Merge existing
                </Button>
              </div>
              <p className="font-mono text-dim/70 text-xs">
                Replace is recommended when migrating to a clean instance. Merge keeps the current
                instance data and overlays the imported backup on top.
              </p>
            </div>
          </div>

          {Boolean(fullBackupError) && (
            <p className="font-mono text-destructive text-xs">{fullBackupError}</p>
          )}

          {Boolean(fullImportResult) && (
            <p className="font-mono text-dim/60 text-xs">{fullImportResult}</p>
          )}
        </SettingsPanel>

        <SettingsPanel
          title="Advanced Tools"
          description="These are partial exports for diagnostics or targeted moves. They are not full-instance migration backups."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="font-mono text-dim text-xs uppercase tracking-wider">Config Snapshot</p>
              <p className="font-mono text-dim/70 text-xs">
                Layouts, preferences, project wiring, and plugin data. Credential values are not
                included here.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" uppercase={false} onClick={handleConfigExport}>
                  <Download className="icon-xs" />
                  Export Config
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  uppercase={false}
                  onClick={() => {
                    handleConfigImport().catch(() => undefined);
                  }}
                  disabled={configImporting}
                >
                  <Upload className="icon-xs" />
                  {configImporting ? "Importing..." : "Import Config"}
                </Button>
              </div>
            </div>

            <p className="font-mono text-dim/70 text-xs">
              Per-source data exports remain available in Backup &amp; Export when you need a JSON
              or CSV dump for a single integration.
            </p>
          </div>

          {Boolean(configExportError) && (
            <p className="font-mono text-destructive text-xs">{configExportError}</p>
          )}

          {Boolean(configImportError) && (
            <p className="font-mono text-destructive text-xs">{configImportError}</p>
          )}

          {Boolean(configImportResult) && (
            <p className="font-mono text-dim/60 text-xs">{configImportResult}</p>
          )}
        </SettingsPanel>
      </div>
    </SettingsPageLayout>
  );
}
