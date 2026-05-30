/**
 * Widget registry conformance tests.
 *
 * Validates that all widget descriptors meet structural invariants:
 * - Unique IDs
 * - Required fields present and well-formed
 * - No duplicate variant IDs per widget
 * - Description length within limits
 * - Visual editor uses the template kind
 * - Required integrations is an array
 *
 * Exported as `runWidgetConformance()` so downstream packages can
 * call it against the real WIDGET_REGISTRY.
 */

import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";
import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGET_MODAL_SIZE } from "./widget-modal";

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const MAX_DESCRIPTION_LENGTH = 120;

/**
 * Run conformance checks against an array of widget descriptors.
 * Exported so downstream packages can call `runWidgetConformance(getAllWidgets())`.
 */
export function runWidgetConformance(descriptors: WidgetDescriptor[]) {
  describe("widget registry conformance", () => {
    it("has at least one registered widget", () => {
      expect(descriptors.length).toBeGreaterThan(0);
    });

    it("all IDs are unique", () => {
      const ids = descriptors.map((d) => d.id);
      expect(ids).toEqual([...new Set(ids)]);
    });

    it("all IDs are kebab-case", () => {
      for (const d of descriptors) {
        expect(d.id, `Widget "${d.id}" is not kebab-case`).toMatch(KEBAB_CASE);
      }
    });

    it("all have required display fields", () => {
      for (const d of descriptors) {
        expect(d.name, `Widget "${d.id}" missing name`).toBeTruthy();
        expect(d.description, `Widget "${d.id}" missing description`).toBeTruthy();
        expect(d.component, `Widget "${d.id}" missing component`).toBeTruthy();
      }
    });

    it("descriptions are within max length", () => {
      for (const d of descriptors) {
        expect(
          d.description.length,
          `Widget "${d.id}" description exceeds ${MAX_DESCRIPTION_LENGTH} chars (${d.description.length})`
        ).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
      }
    });

    it("requiredIntegrations is an array", () => {
      for (const d of descriptors) {
        expect(
          Array.isArray(d.requiredIntegrations),
          `Widget "${d.id}" requiredIntegrations is not an array`
        ).toBe(true);
      }
    });

    it("defaultSlot is a valid grid slot", () => {
      const validSlots = new Set([
        "slot1",
        "slot2",
        "slot3",
        "slot4",
        "slot5",
        "slot6",
        "slot7",
        "slot8",
        "slot9",
      ]);
      for (const d of descriptors) {
        expect(
          validSlots.has(d.defaultSlot),
          `Widget "${d.id}" has invalid defaultSlot "${d.defaultSlot}"`
        ).toBe(true);
      }
    });

    it("all use template visual editor", () => {
      for (const d of descriptors) {
        if (!d.visualEditor) continue;
        expect(d.visualEditor.kind, `Widget "${d.id}" must use the template visual editor`).toBe(
          "template"
        );
      }
    });

    it("no duplicate variant IDs per widget", () => {
      for (const d of descriptors) {
        if (!d.variants?.length) continue;
        const ids = d.variants.map((v) => v.id);
        expect(ids, `Widget "${d.id}" has duplicate variant IDs`).toEqual([...new Set(ids)]);
      }
    });

    it("at most one default variant per widget", () => {
      for (const d of descriptors) {
        if (!d.variants?.length) continue;
        const defaults = d.variants.filter((v) => v.isDefault);
        expect(
          defaults.length,
          `Widget "${d.id}" has ${defaults.length} default variants (max 1)`
        ).toBeLessThanOrEqual(1);
      }
    });

    it("capability metadata has non-empty provider lists", () => {
      for (const d of descriptors) {
        if (!d.capabilities?.length) continue;
        for (const capability of d.capabilities) {
          expect(
            capability.providers.length,
            `Widget "${d.id}" capability "${capability.id}" must declare at least one provider`
          ).toBeGreaterThan(0);
        }
      }
    });

    it("does not declare duplicate capability ids per widget", () => {
      for (const d of descriptors) {
        if (!d.capabilities?.length) continue;
        const ids = d.capabilities.map((capability) => capability.id);
        expect(ids, `Widget "${d.id}" has duplicate capability ids`).toEqual([...new Set(ids)]);
      }
    });

    it("has at most one canonical widget per capability across the registry", () => {
      const canonicalOwnership = new Map<string, string>();
      for (const d of descriptors) {
        for (const capability of d.capabilities ?? []) {
          if (capability.role !== "canonical") continue;
          const existingOwner = canonicalOwnership.get(capability.id);
          expect(
            existingOwner,
            `Capability "${capability.id}" is claimed as canonical by both "${existingOwner}" and "${d.id}"`
          ).toBeUndefined();
          canonicalOwnership.set(capability.id, d.id);
        }
      }
    });

    it("expandedSize is a valid size", () => {
      const validSizes = new Set(["sm", "md", "lg"]);
      for (const d of descriptors) {
        if (!d.expandedSize) continue;
        expect(
          validSizes.has(d.expandedSize),
          `Widget "${d.id}" has invalid expandedSize "${d.expandedSize}"`
        ).toBe(true);
      }
    });

    it("relies on the centralized expanded overlay default for built-in widgets", () => {
      for (const d of descriptors) {
        if (!d.expandedComponent) continue;
        expect(
          d.expandedSize,
          `Widget "${d.id}" should omit expandedSize and rely on the centralized "${DEFAULT_WIDGET_MODAL_SIZE}" default`
        ).toBeUndefined();
      }
    });

    it("auth configs have required fields", () => {
      for (const d of descriptors) {
        const auths = d.auth ? (Array.isArray(d.auth) ? d.auth : [d.auth]) : [];
        for (const auth of auths) {
          expect(auth.type, `Widget "${d.id}" auth missing type`).toBeTruthy();
          if (auth.type === "oauth") {
            expect(
              auth.oauth,
              `Widget "${d.id}" is OAuth but missing auth.oauth config`
            ).toBeTruthy();
            expect(auth.oauth?.provider, `Widget "${d.id}" OAuth missing provider`).toBeTruthy();
          }
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Self-test: run conformance against a minimal valid descriptor
// ---------------------------------------------------------------------------

const MinimalComponent = () => null;

const MINIMAL_DESCRIPTOR: WidgetDescriptor = {
  id: "test-widget",
  name: "Test Widget",
  description: "A test widget",
  requiredIntegrations: [],
  defaultSlot: "slot1",
  component: MinimalComponent,
  defaultConfig: {},
};

runWidgetConformance([MINIMAL_DESCRIPTOR]);
