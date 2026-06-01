import { getAllFeatures } from "@radarboard/feature-sdk/registry";
import {
  DATA_SOURCE_REGISTRY,
  findDataSource,
  getAllIntegrations,
} from "@radarboard/integration-sdk/registry";
import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import { getAllWidgets } from "@radarboard/widget-engine/widgets/registry";
import { DATA_SOURCE_REGISTRY as WIDGET_DATA_SOURCE_REGISTRY } from "@radarboard/widget-sdk/data-source-registry";
import { beforeAll, describe, expect, it } from "vitest";
import { APP_SHELL_WIDGET_AUTH_SERVICE_IDS } from "@/lib/integration-data-invalidation";
import config from "../../../../../../radarboard.config";
import "../features";
import { featureDescriptors } from "../features-init";
import "../integrations-init";
import "../plugins-init";
import { initializeWidgets } from "../widgets-init";

const PACKAGE_PREFIXES = {
  feature: "@radarboard/feature-",
  integration: "@radarboard/integration-",
  plugin: "@radarboard/plugin-",
  widget: "@radarboard/widget-",
} as const;

function extensionId(packageName: string, prefix: string): string {
  expect(packageName.startsWith(prefix), `${packageName} should use prefix ${prefix}`).toBe(true);
  return packageName.slice(prefix.length);
}

function expectUnique(ids: string[], label: string): void {
  expect(ids, `${label} should not include duplicates`).toEqual([...new Set(ids)]);
}

function templateDataSourceIds(config: unknown): string[] {
  if (config === null || typeof config !== "object") return [];
  const dataSources = (config as { dataSources?: unknown }).dataSources;
  if (!Array.isArray(dataSources)) return [];

  return dataSources
    .map((dataSource) =>
      dataSource !== null && typeof dataSource === "object"
        ? (dataSource as { id?: unknown }).id
        : null
    )
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

describe("first-party extension health contract", () => {
  beforeAll(async () => {
    await initializeWidgets();
  });

  it("registers every configured integration and virtual integration data source", () => {
    const integrationIds = config.integrations.map((packageName) =>
      extensionId(packageName, PACKAGE_PREFIXES.integration)
    );
    const virtualIntegrationIds = config.virtualIntegrations.map((packageName) =>
      extensionId(packageName, PACKAGE_PREFIXES.integration)
    );
    const registeredIntegrations = getAllIntegrations();
    const registeredIntegrationIds = new Set(
      registeredIntegrations.map((integration) => integration.id)
    );

    expectUnique(integrationIds, "configured integrations");
    expectUnique(virtualIntegrationIds, "configured virtual integrations");

    for (const id of integrationIds) {
      expect(registeredIntegrationIds.has(id), `Integration "${id}" is not registered`).toBe(true);
    }

    for (const integration of registeredIntegrations) {
      for (const dataSource of integration.dataSources ?? []) {
        expect(
          findDataSource(integration.id, dataSource.action),
          `Data source "${integration.id}/${dataSource.action}" is not registered`
        ).toBeDefined();
      }
    }

    for (const id of virtualIntegrationIds) {
      const hasVirtualDataSource = [...DATA_SOURCE_REGISTRY.keys()].some((key) =>
        key.startsWith(`${id}/`)
      );
      expect(
        hasVirtualDataSource,
        `Virtual integration "${id}" has no registered data source`
      ).toBe(true);
    }
  });

  it("registers every configured plugin", () => {
    const pluginIds = config.plugins.map((packageName) =>
      extensionId(packageName, PACKAGE_PREFIXES.plugin)
    );
    const registeredPluginIds = new Set(getAllPlugins().map((plugin) => plugin.id));

    expectUnique(pluginIds, "configured plugins");

    for (const id of pluginIds) {
      expect(registeredPluginIds.has(id), `Plugin "${id}" is not registered`).toBe(true);
    }
  });

  it("registers every configured widget and its template data resolvers", () => {
    const widgetIds = config.widgets.map((packageName) =>
      extensionId(packageName, PACKAGE_PREFIXES.widget)
    );
    const widgets = getAllWidgets();
    const registeredWidgetIds = new Set(widgets.map((widget) => widget.id));

    expectUnique(widgetIds, "configured widgets");

    for (const id of widgetIds) {
      expect(registeredWidgetIds.has(id), `Widget "${id}" is not registered`).toBe(true);
    }

    for (const widget of widgets) {
      const configs = [
        widget.defaultConfig,
        ...(widget.variants ?? []).map((variant) => variant.config),
        widget.visualEditor?.getConfig({
          projectSlug: null,
          projects: [],
          config: widget.defaultConfig,
        }),
      ];
      const dataSourceIds = [...new Set(configs.flatMap(templateDataSourceIds))];

      for (const sourceId of dataSourceIds) {
        expect(
          WIDGET_DATA_SOURCE_REGISTRY.has(sourceId),
          `Widget "${widget.id}" references unregistered template data source "${sourceId}"`
        ).toBe(true);
      }
    }
  });

  it("backs every app-shell widget auth provider with a runtime data source", () => {
    for (const id of APP_SHELL_WIDGET_AUTH_SERVICE_IDS) {
      const hasDataSource = [...DATA_SOURCE_REGISTRY.keys()].some((key) =>
        key.startsWith(`${id}/`)
      );

      expect(
        hasDataSource,
        `App-shell widget auth provider "${id}" has no registered data source`
      ).toBe(true);
    }
  });

  it("registers every configured feature and keeps feature dependencies resolvable", () => {
    const configuredFeaturePackages = config.features.map((packageName) =>
      extensionId(packageName, PACKAGE_PREFIXES.feature)
    );
    const featureIds = featureDescriptors.map((feature) => feature.id);
    const features = getAllFeatures();
    const registeredFeatureIds = new Set(features.map((feature) => feature.id));

    expect(featureDescriptors).toHaveLength(configuredFeaturePackages.length);
    expectUnique(featureIds, "configured features");

    for (const id of featureIds) {
      expect(registeredFeatureIds.has(id), `Feature "${id}" is not registered`).toBe(true);
    }

    for (const feature of features) {
      for (const dependency of feature.requires ?? []) {
        expect(
          registeredFeatureIds.has(dependency),
          `Feature "${feature.id}" depends on unregistered feature "${dependency}"`
        ).toBe(true);
      }
    }
  });
});
