/**
 * Feature registry — Map-based registration following the same pattern
 * as plugin-sdk, integration-sdk, and widget-sdk registries.
 */

import type { FeatureDescriptor } from "./types";

export const FEATURE_REGISTRY = new Map<string, FeatureDescriptor>();

/**
 * Register a feature descriptor. Idempotent — safe to call multiple times
 * (supports HMR and React strict mode).
 */
export function registerFeature(descriptor: FeatureDescriptor): void {
  if (FEATURE_REGISTRY.has(descriptor.id)) return;
  FEATURE_REGISTRY.set(descriptor.id, descriptor);
}

/** Look up a feature by ID. */
export function getFeature(id: string): FeatureDescriptor | undefined {
  return FEATURE_REGISTRY.get(id);
}

/** Get all registered feature descriptors. */
export function getAllFeatures(): FeatureDescriptor[] {
  return Array.from(FEATURE_REGISTRY.values());
}
