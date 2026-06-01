import "@/lib/features";
import "@/lib/integrations-init";
import "@/lib/plugins-init";
import { getAllFeatures } from "@radarboard/feature-sdk/registry";
import { DATA_SOURCE_REGISTRY, getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { checkDependenciesWithCredentials } from "@radarboard/integration-sdk/resolver";
import { createLogger } from "@radarboard/logger/logger";
import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import { getAllWidgets } from "@radarboard/widget-engine/widgets/registry";
import { DATA_SOURCE_ID_REGISTRY } from "@radarboard/widget-sdk/data-source-registry";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";
import { NextResponse } from "next/server";
import { getCredentialRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import {
  auditCapabilityGovernance,
  type CapabilityAudit,
} from "@/lib/extensions/capability-governance";
import { featureDescriptors } from "@/lib/features-init";
import { initializeWidgetDescriptors } from "@/lib/widgets-init";
import config from "../../../../../radarboard.config";

const log = createLogger("api/extensions/health-score");

type ExtensionHealthStatus = "ok" | "warning" | "error";
type ExtensionHealthKind = "feature" | "integration" | "virtual-integration" | "plugin" | "widget";

interface ExtensionHealthIssue {
  level: "warning" | "error";
  code: string;
  message: string;
  extensionId?: string;
  extensionType?: ExtensionHealthKind;
}

interface ExtensionHealthDetail {
  id: string;
  name: string;
  type: ExtensionHealthKind;
  status: ExtensionHealthStatus;
  checks: string[];
  metrics: Record<string, string | number | boolean>;
}

interface HealthScore {
  overall: number;
  coverage: { score: number; configured: number; total: number };
  registry: {
    expected: { features: number; integrations: number; plugins: number; widgets: number };
    registered: { features: number; integrations: number; plugins: number; widgets: number };
    dataSources: { integration: number; widget: number };
  };
  details: ExtensionHealthDetail[];
  issues: ExtensionHealthIssue[];
}

function packageId(packageName: string, prefix: string): string {
  return packageName.startsWith(prefix) ? packageName.slice(prefix.length) : packageName;
}

function statusFromIssues(issues: ExtensionHealthIssue[]): ExtensionHealthStatus {
  if (issues.some((issue) => issue.level === "error")) return "error";
  if (issues.some((issue) => issue.level === "warning")) return "warning";
  return "ok";
}

function templateDataSourceIds(configValue: unknown): string[] {
  if (configValue === null || typeof configValue !== "object") return [];
  const dataSources = (configValue as { dataSources?: unknown }).dataSources;
  if (!Array.isArray(dataSources)) return [];

  return dataSources
    .map((dataSource) =>
      dataSource !== null && typeof dataSource === "object"
        ? (dataSource as { id?: unknown }).id
        : null
    )
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

function collectWidgetTemplateDataSourceIds(
  widget: WidgetDescriptor<Record<string, unknown>>
): string[] {
  const configs: unknown[] = [
    widget.defaultConfig,
    ...(widget.variants ?? []).map((variant) => variant.config),
  ];
  try {
    configs.push(
      widget.visualEditor?.getConfig({
        projectSlug: null,
        projects: [],
        config: widget.defaultConfig,
      })
    );
  } catch (error) {
    if (
      !(
        error instanceof Error &&
        error.message.includes("from the server") &&
        error.message.includes("client")
      )
    ) {
      throw error;
    }
  }

  return [...new Set(configs.flatMap(templateDataSourceIds))];
}

function capabilityIssue(audit: CapabilityAudit): ExtensionHealthIssue {
  return {
    level: audit.level === "error" ? "error" : "warning",
    code: audit.code,
    message: audit.message,
    extensionId: audit.widgetId ?? audit.integrationId,
    extensionType: audit.widgetId ? "widget" : "integration",
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: extension health intentionally compares all extension registries in one debug response.
export async function handleGetExtensionHealthScore() {
  try {
    initializeWidgetDescriptors();

    const integrations = getAllIntegrations();
    const plugins = getAllPlugins();
    const widgets = getAllWidgets();
    const features = getAllFeatures();
    const credRepo = getCredentialRepo();
    const issues: ExtensionHealthIssue[] = [];
    const details: ExtensionHealthDetail[] = [];

    const resolveCredential = async (key: string) => {
      try {
        return await credRepo.getCredential(key);
      } catch {
        return null;
      }
    };

    const integrationIds = integrations.map((i) => i.id);
    const statuses = await checkDependenciesWithCredentials(integrationIds, resolveCredential);

    const configured = statuses.filter((s) => s.configured).length;
    const total = statuses.length;
    const coverageScore = total > 0 ? Math.round((configured / total) * 100) : 0;

    const expectedFeatureIds = new Set(featureDescriptors.map((feature) => feature.id));
    const expectedIntegrationIds = new Set(
      config.integrations.map((packageName) => packageId(packageName, "@radarboard/integration-"))
    );
    const expectedVirtualIntegrationIds = new Set(
      config.virtualIntegrations.map((packageName) =>
        packageId(packageName, "@radarboard/integration-")
      )
    );
    const expectedPluginIds = new Set(
      config.plugins.map((packageName) => packageId(packageName, "@radarboard/plugin-"))
    );
    const expectedWidgetIds = new Set(
      config.widgets.map((packageName) => packageId(packageName, "@radarboard/widget-"))
    );

    const registeredFeatureIds = new Set(features.map((feature) => feature.id));
    const registeredIntegrationIds = new Set(integrations.map((integration) => integration.id));
    const registeredPluginIds = new Set(plugins.map((plugin) => plugin.id));
    const registeredWidgetIds = new Set(widgets.map((widget) => widget.id));

    for (const featureId of expectedFeatureIds) {
      if (!registeredFeatureIds.has(featureId)) {
        issues.push({
          level: "error",
          code: "feature-not-registered",
          extensionId: featureId,
          extensionType: "feature",
          message: `Feature "${featureId}" is configured but not registered.`,
        });
      }
    }

    for (const feature of features) {
      const featureIssues: ExtensionHealthIssue[] = [];
      for (const dependency of feature.requires ?? []) {
        if (registeredFeatureIds.has(dependency)) continue;
        featureIssues.push({
          level: "error",
          code: "missing-feature-dependency",
          extensionId: feature.id,
          extensionType: "feature",
          message: `Feature "${feature.id}" depends on missing feature "${dependency}".`,
        });
      }
      issues.push(...featureIssues);
      details.push({
        id: feature.id,
        name: feature.label,
        type: "feature",
        status: statusFromIssues(featureIssues),
        checks: [
          "registered",
          feature.requires?.length ? `${feature.requires.length} dependencies` : "no dependencies",
        ],
        metrics: {
          plan: feature.plan ?? "free",
          category: feature.category ?? "uncategorized",
          defaultEnabled: feature.defaultEnabled,
        },
      });
    }

    for (const integrationId of expectedIntegrationIds) {
      if (!registeredIntegrationIds.has(integrationId)) {
        issues.push({
          level: "error",
          code: "integration-not-registered",
          extensionId: integrationId,
          extensionType: "integration",
          message: `Integration "${integrationId}" is configured but not registered.`,
        });
      }
    }

    for (const integration of integrations) {
      const credentialStatus = statuses.find((status) => status.integrationId === integration.id);
      const integrationIssues: ExtensionHealthIssue[] = [];
      for (const dataSource of integration.dataSources ?? []) {
        if (DATA_SOURCE_REGISTRY.has(`${integration.id}/${dataSource.action}`)) continue;
        integrationIssues.push({
          level: "error",
          code: "integration-data-source-missing",
          extensionId: integration.id,
          extensionType: "integration",
          message: `Integration "${integration.id}" declares data source "${dataSource.action}" but it is not registered.`,
        });
      }

      if (credentialStatus && !credentialStatus.configured) {
        integrationIssues.push({
          level: "warning",
          code: "integration-credentials-missing",
          extensionId: integration.id,
          extensionType: "integration",
          message: `Integration "${integration.id}" has no saved credentials.`,
        });
      }

      issues.push(...integrationIssues);
      details.push({
        id: integration.id,
        name: integration.name,
        type: "integration",
        status: statusFromIssues(integrationIssues),
        checks: [
          "registered",
          `${integration.dataSources?.length ?? 0} data sources`,
          credentialStatus?.configured ? "credentials saved" : "credentials missing",
        ],
        metrics: {
          category: integration.category,
          configured: credentialStatus?.configured ?? false,
          capabilities: integration.capabilities?.length ?? 0,
        },
      });
    }

    for (const integrationId of expectedVirtualIntegrationIds) {
      const hasDataSource = [...DATA_SOURCE_REGISTRY.keys()].some((key) =>
        key.startsWith(`${integrationId}/`)
      );
      const virtualIssues: ExtensionHealthIssue[] = [];
      if (!hasDataSource) {
        virtualIssues.push({
          level: "error",
          code: "virtual-integration-data-source-missing",
          extensionId: integrationId,
          extensionType: "virtual-integration",
          message: `Virtual integration "${integrationId}" has no registered data sources.`,
        });
      }
      issues.push(...virtualIssues);
      details.push({
        id: integrationId,
        name: integrationId,
        type: "virtual-integration",
        status: statusFromIssues(virtualIssues),
        checks: [hasDataSource ? "data source registered" : "data source missing"],
        metrics: {
          dataSources: [...DATA_SOURCE_REGISTRY.keys()].filter((key) =>
            key.startsWith(`${integrationId}/`)
          ).length,
        },
      });
    }

    for (const pluginId of expectedPluginIds) {
      if (!registeredPluginIds.has(pluginId)) {
        issues.push({
          level: "error",
          code: "plugin-not-registered",
          extensionId: pluginId,
          extensionType: "plugin",
          message: `Plugin "${pluginId}" is configured but not registered.`,
        });
      }
    }

    for (const plugin of plugins) {
      details.push({
        id: plugin.id,
        name: plugin.name,
        type: "plugin",
        status: "ok",
        checks: ["registered", `${plugin.launchSurfaces?.length ?? 0} launch surfaces`],
        metrics: {
          category: plugin.category ?? "uncategorized",
          widgets: plugin.widgets?.length ?? 0,
          tools: plugin.mcpTools?.length ?? 0,
        },
      });
    }

    for (const widgetId of expectedWidgetIds) {
      if (!registeredWidgetIds.has(widgetId)) {
        issues.push({
          level: "error",
          code: "widget-not-registered",
          extensionId: widgetId,
          extensionType: "widget",
          message: `Widget "${widgetId}" is configured but not registered.`,
        });
      }
    }

    for (const widget of widgets) {
      const widgetIssues: ExtensionHealthIssue[] = [];
      const templateSourceIds = collectWidgetTemplateDataSourceIds(widget);
      for (const sourceId of templateSourceIds) {
        if (DATA_SOURCE_ID_REGISTRY.has(sourceId)) continue;
        widgetIssues.push({
          level: "error",
          code: "widget-template-data-source-missing",
          extensionId: widget.id,
          extensionType: "widget",
          message: `Widget "${widget.id}" references missing template data source "${sourceId}".`,
        });
      }

      issues.push(...widgetIssues);
      details.push({
        id: widget.id,
        name: widget.name,
        type: "widget",
        status: statusFromIssues(widgetIssues),
        checks: [
          "registered",
          `${templateSourceIds.length} template data sources`,
          `${widget.variants?.length ?? 0} variants`,
        ],
        metrics: {
          category: widget.catalogCategory ?? "uncategorized",
          resolvers: templateSourceIds.length,
          capabilities: widget.capabilities?.length ?? 0,
        },
      });
    }

    const capabilityIssues = auditCapabilityGovernance(integrations, widgets).map(capabilityIssue);
    issues.push(...capabilityIssues);

    const result: HealthScore = {
      overall: coverageScore,
      coverage: { score: coverageScore, configured, total },
      registry: {
        expected: {
          features: expectedFeatureIds.size,
          integrations: expectedIntegrationIds.size + expectedVirtualIntegrationIds.size,
          plugins: expectedPluginIds.size,
          widgets: expectedWidgetIds.size,
        },
        registered: {
          features: features.length,
          integrations: integrations.length + expectedVirtualIntegrationIds.size,
          plugins: plugins.length,
          widgets: widgets.length,
        },
        dataSources: {
          integration: DATA_SOURCE_REGISTRY.size,
          widget: DATA_SOURCE_ID_REGISTRY.size,
        },
      },
      details,
      issues,
    };

    return NextResponse.json(result);
  } catch (err) {
    log.error("Failed to compute health score", {
      error: err,
      errorMessage: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return errorJson(500, err instanceof Error ? err.message : "Failed to compute health score");
  }
}
