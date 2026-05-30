/**
 * Widget variant resolution utilities.
 *
 * Pure functions for resolving which variant config to render,
 * managing custom variants, and extracting instance-level overrides.
 *
 * All widgets support variants — widgets without explicit `variants`
 * get a synthesized "Default" variant from their `defaultConfig`.
 */

import type { CustomVariant, WidgetDescriptor, WidgetVariant } from "./widget-types";

/** Sentinel ID for the synthesized default variant (widgets without explicit variants). */
export const DEFAULT_VARIANT_ID = "__default__";

/**
 * Config keys that belong to the widget instance, not the variant template.
 * These are preserved across variant switches.
 */
const INSTANCE_OVERRIDE_KEYS = new Set([
  "activeVariant",
  "customVariants",
  "fontScale",
  "maxItems",
  "ignoreTimeRange",
  "disabledServices",
  "includePackages",
  "excludePackages",
  "selectedRepos",
  "showReadItems",
]);

/** Get the built-in variants, synthesizing a "Default" if none are declared. */
function getBuiltInVariants<TConfig>(
  descriptor: WidgetDescriptor<TConfig>
): WidgetVariant<TConfig>[] {
  if (descriptor.variants?.length) return descriptor.variants;
  return [
    { id: DEFAULT_VARIANT_ID, name: "Default", config: descriptor.defaultConfig, isDefault: true },
  ];
}

/** Get the default variant (first with `isDefault: true`, or the first in the array). */
export function getDefaultVariant<TConfig>(
  descriptor: WidgetDescriptor<TConfig>
): WidgetVariant<TConfig> {
  const variants = getBuiltInVariants(descriptor);
  return variants.find((v) => v.isDefault) ?? variants[0]!;
}

/**
 * Resolve the active variant's base config.
 *
 * Resolution order:
 * 1. `activeVariant` matches a built-in variant → that variant's config
 * 2. `activeVariant` matches a custom variant → that custom variant's config
 * 3. Fallback → default variant's config
 */
export function resolveVariantConfig<TConfig>(
  descriptor: WidgetDescriptor<TConfig>,
  instanceConfig: Record<string, unknown>
): TConfig {
  const variants = getBuiltInVariants(descriptor);
  const activeId = instanceConfig.activeVariant as string | undefined;

  if (activeId) {
    const builtIn = variants.find((v) => v.id === activeId);
    if (builtIn) return builtIn.config;

    const customVariants = (instanceConfig.customVariants ?? []) as CustomVariant[];
    const custom = customVariants.find((v) => v.id === activeId);
    if (custom) return custom.config as TConfig;
  }

  return getDefaultVariant(descriptor).config;
}

/** Metadata about a variant for the picker UI. */
export interface VariantOption {
  id: string;
  name: string;
  isBuiltIn: boolean;
}

/** Get all available variants (built-in + custom) for the picker UI. */
export function getAvailableVariants<TConfig>(
  descriptor: WidgetDescriptor<TConfig>,
  instanceConfig: Record<string, unknown>
): VariantOption[] {
  const builtIn: VariantOption[] = getBuiltInVariants(descriptor).map((v) => ({
    id: v.id,
    name: v.name,
    isBuiltIn: true,
  }));

  const customVariants = (instanceConfig.customVariants ?? []) as CustomVariant[];
  const custom: VariantOption[] = customVariants.map((v) => ({
    id: v.id,
    name: v.name,
    isBuiltIn: false,
  }));

  return [...builtIn, ...custom];
}

/** Get the active variant ID, falling back to the default variant. */
export function getActiveVariantId<TConfig>(
  descriptor: WidgetDescriptor<TConfig>,
  instanceConfig: Record<string, unknown>
): string {
  const variants = getBuiltInVariants(descriptor);
  const activeId = instanceConfig.activeVariant as string | undefined;

  if (activeId) {
    if (variants.some((v) => v.id === activeId)) return activeId;
    const customVariants = (instanceConfig.customVariants ?? []) as CustomVariant[];
    if (customVariants.some((v) => v.id === activeId)) return activeId;
  }

  return getDefaultVariant(descriptor).id;
}

/**
 * Get the config for a specific variant by ID (for rendering previews).
 * Returns the variant's template config, or null if not found.
 */
export function getVariantConfig<TConfig>(
  descriptor: WidgetDescriptor<TConfig>,
  instanceConfig: Record<string, unknown>,
  variantId: string
): TConfig | null {
  const variants = getBuiltInVariants(descriptor);
  const builtIn = variants.find((v) => v.id === variantId);
  if (builtIn) return builtIn.config;

  const customVariants = (instanceConfig.customVariants ?? []) as CustomVariant[];
  const custom = customVariants.find((v) => v.id === variantId);
  if (custom) return custom.config as TConfig;

  return null;
}

/**
 * Extract instance-level overrides that persist across variant switches.
 * These are the non-template fields that should be merged on top of the variant config.
 */
export function extractInstanceOverrides(config: Record<string, unknown>): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  for (const key of Object.keys(config)) {
    if (INSTANCE_OVERRIDE_KEYS.has(key)) {
      overrides[key] = config[key];
    }
  }
  return overrides;
}

/** Create a new custom variant by duplicating a source config. */
export function createCustomVariant(
  name: string,
  sourceConfig: Record<string, unknown>
): CustomVariant {
  return {
    id: crypto.randomUUID(),
    name,
    config: structuredClone(sourceConfig),
  };
}

/** Check whether a variant ID refers to a built-in variant (including synthesized default). */
export function isBuiltInVariant<TConfig>(
  descriptor: WidgetDescriptor<TConfig>,
  variantId: string
): boolean {
  return getBuiltInVariants(descriptor).some((v) => v.id === variantId);
}
