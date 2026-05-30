import type { IntegrationConnection } from "@radarboard/types/database";
import type { McpServerConfig } from "@radarboard/types/mcp-server";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from "react";
import type {
  LinkedMcpDraft,
  McpConnectionTestPayload,
  McpConnectionTestResult,
  ServiceEntry,
} from "./types";
import {
  buildInitialLinkedMcpDraft,
  buildLinkedMcpServer,
  buildMcpTestPayload,
  getAssistantStatus,
  getBindingLabel,
} from "./utils";

export function useAssistantAccessController({
  service,
  connection,
  apiValues,
  linkedServer,
  saveMcpServer,
  testMcpServer,
  onChange,
}: {
  service: ServiceEntry;
  connection: IntegrationConnection | null;
  apiValues: Record<string, string>;
  linkedServer: McpServerConfig | null;
  saveMcpServer: (server: McpServerConfig) => Promise<void>;
  testMcpServer: (payload: McpConnectionTestPayload) => Promise<McpConnectionTestResult>;
  onChange: () => Promise<void> | void;
}): {
  draft: LinkedMcpDraft | null;
  setDraft: Dispatch<SetStateAction<LinkedMcpDraft | null>>;
  showConfig: boolean;
  setShowConfig: Dispatch<SetStateAction<boolean>>;
  saving: boolean;
  testing: boolean;
  togglingActive: boolean;
  feedback: { ok: boolean; message: string } | null;
  hasPreset: boolean;
  docsUrl: string;
  hasMissingBindings: boolean;
  missingBindingLabels: string[];
  hasAuthHeaderBinding: boolean;
  buildResult: { ok: true; value: McpServerConfig } | { ok: false; error: string };
  canPersist: boolean;
  status: { label: string; className: string };
  handleSave: () => Promise<void>;
  handleTest: () => Promise<void>;
  handleToggleActive: (checked: boolean) => Promise<void>;
} {
  const [draft, setDraft] = useState<LinkedMcpDraft | null>(() =>
    buildInitialLinkedMcpDraft(service, linkedServer)
  );
  const [showConfig, setShowConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const config = service.mcpConfig;
  const hasPreset = Boolean(config);

  useEffect(() => {
    setDraft(buildInitialLinkedMcpDraft(service, linkedServer));
  }, [linkedServer, service]);

  const bindings = config?.credentialBindings ?? [];
  const hasAuthHeaderBinding = bindings.some((binding) => binding.target.type === "authHeader");
  const missingBindingLabels = bindings
    .filter((binding) => !(apiValues[binding.sourceField]?.trim().length ?? 0))
    .map((binding) => getBindingLabel(service, binding.sourceField));
  const hasMissingBindings = missingBindingLabels.length > 0;
  const buildResult =
    draft && connection
      ? buildLinkedMcpServer(service, connection, draft)
      : { ok: false as const, error: "Linked MCP draft is unavailable" };
  const buildValue = buildResult.ok ? buildResult.value : null;
  const buildError = buildResult.ok ? null : buildResult.error;
  const canPersist = Boolean(draft && buildResult.ok && !(draft.enabled && hasMissingBindings));
  const docsUrl = config?.docsUrl ?? draft?.docsUrl ?? "";
  const status = getAssistantStatus(linkedServer);

  const handleSave = useCallback(async () => {
    if (buildError) {
      setFeedback({ ok: false, message: buildError });
      return;
    }

    if (hasPreset && draft?.enabled && hasMissingBindings) {
      setFeedback({
        ok: false,
        message: `Save Radarboard access first. Missing: ${missingBindingLabels.join(", ")}`,
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      if (!buildValue) return;
      await saveMcpServer(buildValue);
      await onChange();
      setShowConfig(false);
      setFeedback({
        ok: true,
        message: draft?.enabled ? "Assistant access saved." : "Assistant access disabled.",
      });
    } catch (error) {
      setFeedback({
        ok: false,
        message: error instanceof Error ? error.message : "Failed to save assistant access",
      });
    } finally {
      setSaving(false);
    }
  }, [
    buildError,
    buildValue,
    draft,
    hasMissingBindings,
    hasPreset,
    missingBindingLabels,
    onChange,
    saveMcpServer,
  ]);

  const handleTest = useCallback(async () => {
    if (buildError) {
      setFeedback({ ok: false, message: buildError });
      return;
    }

    setTesting(true);
    setFeedback(null);
    try {
      if (!buildValue) return;
      const result = await testMcpServer(buildMcpTestPayload(buildValue));
      setFeedback({
        ok: result.ok,
        message: result.ok
          ? [result.serverName, result.serverVersion, result.protocolVersion]
              .filter(Boolean)
              .join(" · ") || "Assistant access is ready."
          : (result.error ?? "Connection test failed"),
      });
    } finally {
      setTesting(false);
    }
  }, [buildError, buildValue, testMcpServer]);

  const handleToggleActive = useCallback(
    async (checked: boolean) => {
      if (!draft || !connection) return;

      const nextDraft: LinkedMcpDraft = { ...draft, enabled: checked };
      const nextResult = buildLinkedMcpServer(service, connection, nextDraft);
      if (!nextResult.ok) {
        setFeedback({ ok: false, message: nextResult.error });
        return;
      }

      setDraft(nextDraft);
      setTogglingActive(true);
      setFeedback(null);
      try {
        await saveMcpServer(nextResult.value);
        await onChange();
        setFeedback({
          ok: true,
          message: checked ? "Assistant access activated." : "Assistant access disabled.",
        });
      } catch (error) {
        setFeedback({
          ok: false,
          message: error instanceof Error ? error.message : "Failed to update assistant access",
        });
      } finally {
        setTogglingActive(false);
      }
    },
    [connection, draft, onChange, saveMcpServer, service]
  );

  return {
    draft,
    setDraft,
    showConfig,
    setShowConfig,
    saving,
    testing,
    togglingActive,
    feedback,
    hasPreset,
    docsUrl,
    hasMissingBindings,
    missingBindingLabels,
    hasAuthHeaderBinding,
    buildResult,
    canPersist,
    status,
    handleSave,
    handleTest,
    handleToggleActive,
  };
}
