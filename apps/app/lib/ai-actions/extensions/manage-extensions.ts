/**
 * AI tool for managing and diagnosing extensions.
 *
 * Lets the assistant:
 * - List all extensions with their status
 * - Check health/configuration of specific extensions
 * - Suggest fixes for misconfigured extensions
 * - Get recommendations for new extensions
 */

import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { checkDependenciesWithCredentials } from "@radarboard/integration-sdk/resolver";
import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";

interface ExtensionStatus {
  id: string;
  name: string;
  type: "integration" | "plugin" | "widget";
  category?: string;
  configured?: boolean;
  requiredIntegrations?: string[];
  missingIntegrations?: string[];
}

/**
 * Execute the extension management tool.
 *
 * @param action - "list" | "diagnose" | "recommend"
 * @param extensionId - Specific extension to diagnose (optional)
 * @param resolveCredential - Credential resolver function
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: AI tool handler with inherently branchy action dispatch
export async function executeManageExtensions(
  action: "list" | "diagnose" | "recommend",
  extensionId: string | undefined,
  resolveCredential: (key: string) => Promise<Record<string, string> | null>
): Promise<unknown> {
  if (action === "list") {
    const extensions: ExtensionStatus[] = [];

    for (const i of getAllIntegrations()) {
      const creds = await resolveCredential(i.auth.id);
      extensions.push({
        id: i.id,
        name: i.name,
        type: "integration",
        category: i.category,
        configured: creds !== null && Object.keys(creds).length > 0,
      });
    }

    for (const p of getAllPlugins()) {
      extensions.push({
        id: p.id,
        name: p.name,
        type: "plugin",
        category: p.category,
      });
    }

    for (const [, w] of WIDGET_REGISTRY) {
      extensions.push({
        id: w.id,
        name: w.name,
        type: "widget",
        requiredIntegrations: (w.requiredIntegrations as string[]) ?? [],
      });
    }

    return { extensions, total: extensions.length };
  }

  if (action === "diagnose") {
    if (!extensionId) {
      return { error: "extensionId is required for diagnose action" };
    }

    // Check if it's an integration
    const integration = getAllIntegrations().find((i) => i.id === extensionId);
    if (integration) {
      const creds = await resolveCredential(integration.auth.id);
      const configured = creds !== null && Object.keys(creds).length > 0;
      const dataSources = integration.dataSources?.map((ds) => ds.action) ?? [];
      const mcpTools = integration.mcpTools?.map((t) => t.name) ?? [];

      return {
        id: integration.id,
        name: integration.name,
        type: "integration",
        configured,
        authType: integration.auth.type,
        credentialFields: integration.auth.fields?.map((f) => f.key) ?? [],
        hasCredentials: configured,
        dataSources,
        mcpTools,
        suggestion: configured
          ? "Integration is configured and ready."
          : `Not configured. Ask the user to add ${integration.auth.type === "oauth" ? "OAuth" : "API"} credentials in Settings > Integrations > ${integration.name}.`,
      };
    }

    // Check if it's a widget
    const widget = WIDGET_REGISTRY.get(extensionId);
    if (widget) {
      const required = (widget.requiredIntegrations as string[]) ?? [];
      const statuses = await checkDependenciesWithCredentials(required, resolveCredential);
      const missing = statuses.filter((s) => !s.configured);

      return {
        id: widget.id,
        name: widget.name,
        type: "widget",
        requiredIntegrations: required,
        missingIntegrations: missing.map((s) => s.integrationId),
        allDependenciesMet: missing.length === 0,
        suggestion:
          missing.length === 0
            ? "All dependencies met. The widget should be working."
            : `Missing credentials for: ${missing.map((s) => s.integrationId).join(", ")}. Ask the user to configure these in Settings > Integrations.`,
      };
    }

    // Check if it's a plugin
    const plugin = getAllPlugins().find((p) => p.id === extensionId);
    if (plugin) {
      return {
        id: plugin.id,
        name: plugin.name,
        type: "plugin",
        version: plugin.version,
        mcpTools: plugin.mcpTools?.map((t) => t.name) ?? [],
        intents: plugin.intents?.map((i) => i.action) ?? [],
        suggestion: "Plugin is registered and available.",
      };
    }

    return { error: `Extension "${extensionId}" not found` };
  }

  if (action === "recommend") {
    // Fetch from the recommendations API
    const integrations = getAllIntegrations();
    const integrationIds = integrations.map((i) => i.id);
    const statuses = await checkDependenciesWithCredentials(integrationIds, resolveCredential);
    const configuredIds = new Set(statuses.filter((s) => s.configured).map((s) => s.integrationId));

    const suggestions: Array<{ name: string; type: string; reason: string }> = [];

    for (const [, widget] of WIDGET_REGISTRY) {
      const required = (widget.requiredIntegrations as string[]) ?? [];
      if (required.length === 0) continue;
      const allSatisfied = required.every((id) => configuredIds.has(id));
      if (allSatisfied) {
        suggestions.push({
          name: widget.name,
          type: "widget",
          reason: `Ready to use — all integrations configured (${required.join(", ")})`,
        });
      }
    }

    return { suggestions: suggestions.slice(0, 10) };
  }

  return { error: `Unknown action: ${action}` };
}
