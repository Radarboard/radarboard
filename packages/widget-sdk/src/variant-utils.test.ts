import { describe, expect, it } from "vitest";
import {
  createCustomVariant,
  DEFAULT_VARIANT_ID,
  extractInstanceOverrides,
  getActiveVariantId,
  getAvailableVariants,
  getDefaultVariant,
  getVariantConfig,
  isBuiltInVariant,
  resolveVariantConfig,
} from "./variant-utils";
import type { WidgetDescriptor } from "./widget-types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const configA = { dataSources: [{ id: "a" }], sections: [], label: "A" };
const configB = { dataSources: [{ id: "b" }], sections: [], label: "B" };

/** Widget with two explicit variants. */
const descriptorWithVariants: WidgetDescriptor<Record<string, unknown>> = {
  id: "seo",
  name: "SEO",
  description: "",
  requiredIntegrations: [],
  defaultSlot: "slot1",
  component: () => null,
  defaultConfig: configA,
  variants: [
    { id: "queries", name: "Queries", config: configA, isDefault: true },
    { id: "overview", name: "Overview", config: configB },
  ],
};

/** Widget with no explicit variants (uses synthesized __default__). */
const descriptorNoVariants: WidgetDescriptor<Record<string, unknown>> = {
  id: "stars",
  name: "Stars",
  description: "",
  requiredIntegrations: [],
  defaultSlot: "slot1",
  component: () => null,
  defaultConfig: configA,
};

// ---------------------------------------------------------------------------
// getDefaultVariant
// ---------------------------------------------------------------------------

describe("getDefaultVariant", () => {
  it("returns the variant marked isDefault when explicit variants exist", () => {
    const v = getDefaultVariant(descriptorWithVariants);
    expect(v.id).toBe("queries");
  });

  it("synthesizes a __default__ variant when no variants are defined", () => {
    const v = getDefaultVariant(descriptorNoVariants);
    expect(v.id).toBe(DEFAULT_VARIANT_ID);
    expect(v.name).toBe("Default");
    expect(v.config).toBe(descriptorNoVariants.defaultConfig);
  });

  it("returns the first variant if none is marked isDefault", () => {
    const d: WidgetDescriptor<Record<string, unknown>> = {
      ...descriptorWithVariants,
      variants: [
        { id: "a", name: "A", config: configA },
        { id: "b", name: "B", config: configB },
      ],
    };
    expect(getDefaultVariant(d).id).toBe("a");
  });
});

// ---------------------------------------------------------------------------
// resolveVariantConfig
// ---------------------------------------------------------------------------

describe("resolveVariantConfig", () => {
  it("returns the active built-in variant config", () => {
    const result = resolveVariantConfig(descriptorWithVariants, { activeVariant: "overview" });
    expect(result).toBe(configB);
  });

  it("returns defaultConfig when activeVariant is the synthesized default", () => {
    const result = resolveVariantConfig(descriptorNoVariants, {
      activeVariant: DEFAULT_VARIANT_ID,
    });
    expect(result).toBe(configA);
  });

  it("returns a custom variant config when active", () => {
    const customConfig = { custom: true };
    const result = resolveVariantConfig(descriptorWithVariants, {
      activeVariant: "custom-1",
      customVariants: [{ id: "custom-1", name: "My Custom", config: customConfig }],
    });
    expect(result).toEqual(customConfig);
  });

  it("falls back to default variant when activeVariant is invalid", () => {
    const result = resolveVariantConfig(descriptorWithVariants, { activeVariant: "nonexistent" });
    expect(result).toBe(configA); // queries is default
  });

  it("falls back to default variant when no activeVariant is set", () => {
    const result = resolveVariantConfig(descriptorWithVariants, {});
    expect(result).toBe(configA);
  });

  it("falls back to defaultConfig for widgets without variants and no activeVariant", () => {
    const result = resolveVariantConfig(descriptorNoVariants, {});
    expect(result).toBe(configA);
  });
});

// ---------------------------------------------------------------------------
// getAvailableVariants
// ---------------------------------------------------------------------------

describe("getAvailableVariants", () => {
  it("returns built-in + custom variants for widgets with explicit variants", () => {
    const result = getAvailableVariants(descriptorWithVariants, {
      customVariants: [{ id: "c1", name: "Custom 1", config: {} }],
    });
    expect(result).toEqual([
      { id: "queries", name: "Queries", isBuiltIn: true },
      { id: "overview", name: "Overview", isBuiltIn: true },
      { id: "c1", name: "Custom 1", isBuiltIn: false },
    ]);
  });

  it("returns synthesized Default + custom variants for widgets without explicit variants", () => {
    const result = getAvailableVariants(descriptorNoVariants, {
      customVariants: [{ id: "c1", name: "My Layout", config: {} }],
    });
    expect(result).toEqual([
      { id: DEFAULT_VARIANT_ID, name: "Default", isBuiltIn: true },
      { id: "c1", name: "My Layout", isBuiltIn: false },
    ]);
  });

  it("returns only synthesized Default when no custom variants exist", () => {
    const result = getAvailableVariants(descriptorNoVariants, {});
    expect(result).toEqual([{ id: DEFAULT_VARIANT_ID, name: "Default", isBuiltIn: true }]);
  });
});

// ---------------------------------------------------------------------------
// getActiveVariantId
// ---------------------------------------------------------------------------

describe("getActiveVariantId", () => {
  it("returns the active variant ID when it exists as built-in", () => {
    expect(getActiveVariantId(descriptorWithVariants, { activeVariant: "overview" })).toBe(
      "overview"
    );
  });

  it("returns the active variant ID when it exists as custom", () => {
    const result = getActiveVariantId(descriptorWithVariants, {
      activeVariant: "custom-1",
      customVariants: [{ id: "custom-1", name: "C", config: {} }],
    });
    expect(result).toBe("custom-1");
  });

  it("falls back to default variant ID when activeVariant is invalid", () => {
    expect(getActiveVariantId(descriptorWithVariants, { activeVariant: "gone" })).toBe("queries");
  });

  it("returns default variant ID when no activeVariant set", () => {
    expect(getActiveVariantId(descriptorWithVariants, {})).toBe("queries");
  });

  it("returns __default__ for widgets without explicit variants", () => {
    expect(getActiveVariantId(descriptorNoVariants, {})).toBe(DEFAULT_VARIANT_ID);
  });
});

// ---------------------------------------------------------------------------
// getVariantConfig
// ---------------------------------------------------------------------------

describe("getVariantConfig", () => {
  it("returns built-in variant config by ID", () => {
    expect(getVariantConfig(descriptorWithVariants, {}, "overview")).toBe(configB);
  });

  it("returns custom variant config by ID", () => {
    const customConfig = { custom: true };
    const result = getVariantConfig(
      descriptorWithVariants,
      {
        customVariants: [{ id: "c1", name: "C", config: customConfig }],
      },
      "c1"
    );
    expect(result).toEqual(customConfig);
  });

  it("returns null for unknown variant ID", () => {
    expect(getVariantConfig(descriptorWithVariants, {}, "nonexistent")).toBeNull();
  });

  it("returns defaultConfig for synthesized __default__", () => {
    expect(getVariantConfig(descriptorNoVariants, {}, DEFAULT_VARIANT_ID)).toBe(configA);
  });
});

// ---------------------------------------------------------------------------
// extractInstanceOverrides
// ---------------------------------------------------------------------------

describe("extractInstanceOverrides", () => {
  it("extracts only instance-level keys", () => {
    const config = {
      fontScale: "lg",
      maxItems: 10,
      activeVariant: "overview",
      customVariants: [],
      dataSources: [{ id: "a" }],
      sections: [],
      someTemplateField: true,
    };
    const result = extractInstanceOverrides(config);
    expect(result).toEqual({
      fontScale: "lg",
      maxItems: 10,
      activeVariant: "overview",
      customVariants: [],
    });
    expect(result).not.toHaveProperty("dataSources");
    expect(result).not.toHaveProperty("sections");
    expect(result).not.toHaveProperty("someTemplateField");
  });

  it("returns empty object when no instance keys present", () => {
    expect(extractInstanceOverrides({ dataSources: [], sections: [] })).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// createCustomVariant
// ---------------------------------------------------------------------------

describe("createCustomVariant", () => {
  it("creates a variant with a UUID and deep-cloned config", () => {
    const source = { dataSources: [{ id: "a" }], nested: { value: 1 } };
    const variant = createCustomVariant("My Variant", source);

    expect(variant.name).toBe("My Variant");
    expect(variant.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    expect(variant.config).toEqual(source);
    expect(variant.config).not.toBe(source); // deep clone
    expect((variant.config as Record<string, unknown>).nested).not.toBe(source.nested);
  });
});

// ---------------------------------------------------------------------------
// isBuiltInVariant
// ---------------------------------------------------------------------------

describe("isBuiltInVariant", () => {
  it("returns true for explicit built-in variant IDs", () => {
    expect(isBuiltInVariant(descriptorWithVariants, "queries")).toBe(true);
    expect(isBuiltInVariant(descriptorWithVariants, "overview")).toBe(true);
  });

  it("returns false for custom variant IDs", () => {
    expect(isBuiltInVariant(descriptorWithVariants, "custom-1")).toBe(false);
  });

  it("returns true for synthesized __default__ on widgets without variants", () => {
    expect(isBuiltInVariant(descriptorNoVariants, DEFAULT_VARIANT_ID)).toBe(true);
  });

  it("returns false for random IDs on widgets without variants", () => {
    expect(isBuiltInVariant(descriptorNoVariants, "random")).toBe(false);
  });
});
