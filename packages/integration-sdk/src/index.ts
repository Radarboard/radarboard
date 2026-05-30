/**
 * @radarboard/integration-sdk — Public API
 *
 * Shared types, registry, and utilities for building integrations.
 * Individual integration packages depend on this SDK for their contracts.
 */

// biome-ignore-all lint/performance/noBarrelFile: package public API entry point

// Registry
export {
  DATA_SOURCE_REGISTRY,
  findDataSource,
  getAllIntegrations,
  getIntegration,
  INTEGRATION_REGISTRY,
  registerDataSources,
  registerIntegration,
} from "./registry";
export type { DependencyStatus } from "./resolver";

// Dependency resolver
export {
  checkDependencies,
  checkDependenciesWithCredentials,
  getMissingDependencies,
} from "./resolver";
export type { TrackedDataSourceContext } from "./testing";

// Testing utilities
export { createMockDataSourceContext } from "./testing";
// Core types
export type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
  DeltaDetector,
  IntegrationAuth,
  IntegrationAuthField,
  IntegrationCapability,
  IntegrationCategory,
  IntegrationDescriptor,
  IntegrationEvent,
  IntegrationMcpConnectionConfig,
  IntegrationMcpCredentialBinding,
  IntegrationMcpTool,
  IntegrationMcpTransportPreset,
  IntegrationOAuthConfig,
  TimeRange,
  WebhookHandler,
} from "./types";
