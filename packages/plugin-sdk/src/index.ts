/**
 * @radarboard/plugin-sdk — Public API
 *
 * Shared types, registry, host, and utilities for building plugins.
 * Individual plugin packages depend on this SDK for their contracts.
 */

// biome-ignore-all lint/performance/noBarrelFile: package public API entry point

// CRUD helpers
export type { CrudHelper, Identifiable } from "./crud-helpers";
export { createCrudHelper } from "./crud-helpers";
export type { PluginHostProps } from "./host";
export { PluginHost } from "./host";
// Lifecycle
export { PluginLifecycleRunner } from "./lifecycle";
// Registry
export { getAllPlugins, getPlugin, PLUGIN_REGISTRY, registerPlugin } from "./registry";
export { pluginStore, setPluginSelection } from "./store";
// Core types
export type {
  McpToolDefinition,
  PluginAPI,
  PluginConnectionType,
  PluginDataSource,
  PluginDescriptor,
  PluginLifecycleCleanup,
  PluginLifecycleHooks,
  PluginRadarboardIntegrationConfig,
  PluginRadarboardSurfaceConfig,
  PluginRenderProps,
  PluginSettingDefinition,
  PluginSettingType,
  PluginUserConfig,
  PluginWidgetContribution,
} from "./types";
export {
  isPluginNotificationIntegrationEnabled,
  isPluginTickerIntegrationEnabled,
  pluginSupportsNotifications,
  pluginSupportsTicker,
} from "./types";
export { PluginAPIContext, usePluginAPI } from "./use-plugin-api";
export { usePluginSearchParam } from "./use-plugin-search-param";
