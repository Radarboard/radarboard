"use client";

import { useMcpServers } from "@radarboard/hooks/use-mcp-servers";
import type { McpServerConfig } from "@radarboard/types/mcp-server";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  buildConnectionTestPayload,
  buildServerPayload,
  buildTransportPayload,
  type FormState,
  getFormInitialValues,
  type PanelMode,
  ServerDetailPanel,
  type TestStatus,
} from "./server-detail-panel";
import {
  type ConnectionState,
  filterServersByManagedStatus,
  filterServersBySearch,
  ServerListPanel,
} from "./server-list-panel";

export type { ConnectionState } from "./server-list-panel";

export function SettingsMcpServers() {
  const { servers, loading, error, addOrUpdate, remove, testConnection } = useMcpServers();

  const [connectionStateByName, setConnectionStateByName] = useState<
    Record<string, ConnectionState>
  >({});
  const [uiState, setUiState] = useState<{
    deletingName: string | null;
    panelMode: PanelMode;
    saveError: string | null;
    saving: boolean;
    serverSearch: string;
    testStatus: TestStatus;
  }>({
    deletingName: null,
    panelMode: { type: "idle" },
    saveError: null,
    saving: false,
    serverSearch: "",
    testStatus: { state: "idle" },
  });
  const { deletingName, panelMode, saveError, saving, serverSearch, testStatus } = uiState;
  const selectedName = panelMode.type === "editing" ? panelMode.server.name : null;
  const formInitialValues = useMemo(() => getFormInitialValues(panelMode), [panelMode]);
  const { custom: customServers, managed: managedServers } = useMemo(
    () => filterServersByManagedStatus(servers),
    [servers]
  );

  const handleSelectServer = useCallback((server: McpServerConfig) => {
    setUiState((current) => ({
      ...current,
      panelMode: { type: "editing", server },
      saveError: null,
      testStatus: { state: "idle" },
    }));
  }, []);

  const handleAddNew = useCallback(() => {
    setUiState((current) => ({
      ...current,
      panelMode: { type: "creating" },
      saveError: null,
      testStatus: { state: "idle" },
    }));
  }, []);

  const handleCancel = useCallback(() => {
    setUiState((current) => ({
      ...current,
      panelMode: { type: "idle" },
      saveError: null,
      testStatus: { state: "idle" },
    }));
  }, []);

  const handleDelete = useCallback(
    async (name: string) => {
      setUiState((current) => ({ ...current, deletingName: name }));
      try {
        await remove(name);
        if (selectedName === name) {
          setUiState((current) => ({ ...current, panelMode: { type: "idle" } }));
        }
        toast.success(`Removed ${name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Couldn't remove ${name}`);
      } finally {
        setUiState((current) => ({ ...current, deletingName: null }));
      }
    },
    [remove, selectedName]
  );

  const handleTest = useCallback(
    async (form: FormState) => {
      const payload = buildTransportPayload(form);
      if (!payload.ok) {
        setUiState((current) => ({
          ...current,
          testStatus: { state: "error", message: payload.error },
        }));
        return;
      }

      setUiState((current) => ({ ...current, testStatus: { state: "testing" } }));
      const result = await testConnection(payload.value);
      if (result.ok) {
        setUiState((current) => ({
          ...current,
          testStatus: {
            state: "ok",
            serverName: result.serverName,
            serverVersion: result.serverVersion,
            protocolVersion: result.protocolVersion,
          },
        }));
      } else {
        setUiState((current) => ({
          ...current,
          testStatus: { state: "error", message: result.error ?? "Connection failed" },
        }));
      }
    },
    [testConnection]
  );

  const handleSave = useCallback(
    async (form: FormState) => {
      const payload = buildServerPayload(form);
      if (!payload.ok) {
        setUiState((current) => ({ ...current, saveError: payload.error }));
        return;
      }

      setUiState((current) => ({ ...current, saving: true, saveError: null }));
      try {
        await addOrUpdate(payload.value);
        setUiState((current) => ({
          ...current,
          panelMode: { type: "editing", server: payload.value },
          testStatus: { state: "idle" },
        }));
      } catch (err) {
        setUiState((current) => ({
          ...current,
          saveError: err instanceof Error ? err.message : "Failed to save server",
        }));
      } finally {
        setUiState((current) => ({ ...current, saving: false }));
      }
    },
    [addOrUpdate]
  );

  const showForm = panelMode.type === "creating" || panelMode.type === "editing";

  const filteredCustomServers = useMemo(
    () => filterServersBySearch(customServers, serverSearch),
    [customServers, serverSearch]
  );
  const filteredManagedServers = useMemo(
    () => filterServersBySearch(managedServers, serverSearch),
    [managedServers, serverSearch]
  );

  useEffect(() => {
    let cancelled = false;

    setConnectionStateByName(
      Object.fromEntries(
        servers.map((server) => [
          server.name,
          server.enabled ? ("testing" as const) : ("idle" as const),
        ])
      )
    );

    const enabledServers = servers.filter((server) => server.enabled);
    if (enabledServers.length === 0) return () => undefined;

    (async () => {
      for (const server of enabledServers) {
        const result = await testConnection(buildConnectionTestPayload(server));

        if (cancelled) return;

        setConnectionStateByName((prev) => ({
          ...prev,
          [server.name]: result.ok ? "ok" : "error",
        }));
      }
    })().catch(() => {
      /* fire-and-forget */
    });

    return () => {
      cancelled = true;
    };
  }, [servers, testConnection]);

  useEffect(() => {
    if (loading || panelMode.type === "creating") return;

    if (customServers.length === 0) {
      if (panelMode.type !== "idle") {
        setUiState((current) => ({ ...current, panelMode: { type: "idle" } }));
      }
      return;
    }

    if (panelMode.type === "editing") {
      const stillExists = customServers.some((server) => server.name === panelMode.server.name);
      if (stillExists) return;
    }

    const firstServer = customServers[0];
    if (!firstServer) return;

    setUiState((current) => ({
      ...current,
      panelMode: { type: "editing", server: firstServer },
      saveError: null,
      testStatus: { state: "idle" },
    }));
  }, [customServers, loading, panelMode]);

  return (
    <div className="relative flex h-full min-h-0 overflow-x-hidden">
      <ServerListPanel
        loading={loading}
        error={error}
        filteredCustomServers={filteredCustomServers}
        filteredManagedServers={filteredManagedServers}
        connectionStateByName={connectionStateByName}
        selectedName={selectedName}
        deletingName={deletingName}
        showForm={showForm}
        servers={servers}
        serverSearch={serverSearch}
        onSearchChange={(value) => setUiState((current) => ({ ...current, serverSearch: value }))}
        onAddNew={handleAddNew}
        onSelectServer={handleSelectServer}
        onDeleteServer={(name) => {
          handleDelete(name).catch(() => {
            /* fire-and-forget */
          });
        }}
      />

      <ServerDetailPanel
        panelMode={panelMode}
        formInitialValues={formInitialValues}
        onSave={handleSave}
        onCancel={handleCancel}
        onTest={handleTest}
        testStatus={testStatus}
        saving={saving}
        saveError={saveError}
        onAddNew={handleAddNew}
      />
    </div>
  );
}
