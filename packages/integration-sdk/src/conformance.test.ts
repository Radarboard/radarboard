/**
 * Integration registry conformance tests.
 *
 * Validates that all integration descriptors meet structural invariants:
 * - Unique IDs
 * - Required fields present and well-formed
 * - Auth config consistency (OAuth requires oauth config)
 * - No duplicate data source actions per integration
 * - No duplicate MCP tool names after namespacing
 * - Data sources have fetch functions
 *
 * Exported as `runIntegrationConformance()` so downstream packages can
 * call it against the real INTEGRATION_REGISTRY.
 */

import { describe, expect, it } from "vitest";
import type { IntegrationDescriptor } from "./types";

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Run conformance checks against an array of integration descriptors.
 */
export function runIntegrationConformance(descriptors: IntegrationDescriptor[]) {
  describe("integration registry conformance", () => {
    it("has at least one registered integration", () => {
      expect(descriptors.length).toBeGreaterThan(0);
    });

    it("all IDs are unique", () => {
      const ids = descriptors.map((d) => d.id);
      expect(ids).toEqual([...new Set(ids)]);
    });

    it("all IDs are kebab-case", () => {
      for (const d of descriptors) {
        expect(d.id, `Integration "${d.id}" is not kebab-case`).toMatch(KEBAB_CASE);
      }
    });

    it("all have required display fields", () => {
      for (const d of descriptors) {
        expect(d.name, `Integration "${d.id}" missing name`).toBeTruthy();
        expect(d.description, `Integration "${d.id}" missing description`).toBeTruthy();
        expect(d.icon, `Integration "${d.id}" missing icon`).toBeTruthy();
        expect(d.category, `Integration "${d.id}" missing category`).toBeTruthy();
      }
    });

    it("all have auth config", () => {
      for (const d of descriptors) {
        expect(d.auth, `Integration "${d.id}" missing auth`).toBeTruthy();
        expect(d.auth.id, `Integration "${d.id}" auth missing id`).toBeTruthy();
        expect(d.auth.type, `Integration "${d.id}" auth missing type`).toBeTruthy();
      }
    });

    it("OAuth integrations have oauth config", () => {
      for (const d of descriptors) {
        if (d.auth.type === "oauth") {
          expect(
            d.auth.oauth,
            `Integration "${d.id}" is OAuth but missing auth.oauth config`
          ).toBeTruthy();
          expect(
            d.auth.oauth?.provider,
            `Integration "${d.id}" OAuth missing provider`
          ).toBeTruthy();
        }
      }
    });

    it("API key integrations have at least one field", () => {
      for (const d of descriptors) {
        if (d.auth.type === "api_key") {
          expect(
            d.auth.fields?.length,
            `Integration "${d.id}" is api_key but has no auth fields`
          ).toBeGreaterThan(0);
        }
      }
    });

    it("no duplicate data source actions per integration", () => {
      for (const d of descriptors) {
        if (!d.dataSources?.length) continue;
        const actions = d.dataSources.map((ds) => ds.action);
        expect(actions, `Integration "${d.id}" has duplicate data source actions`).toEqual([
          ...new Set(actions),
        ]);
      }
    });

    it("all data sources have fetch functions", () => {
      for (const d of descriptors) {
        for (const ds of d.dataSources ?? []) {
          expect(
            typeof ds.fetch,
            `Integration "${d.id}" data source "${ds.action}" missing fetch`
          ).toBe("function");
        }
      }
    });

    it("all data sources have cacheTtlSeconds > 0", () => {
      for (const d of descriptors) {
        for (const ds of d.dataSources ?? []) {
          expect(
            ds.cacheTtlSeconds,
            `Integration "${d.id}" data source "${ds.action}" has invalid cacheTtlSeconds`
          ).toBeGreaterThan(0);
        }
      }
    });

    it("capability actions reference existing data source actions", () => {
      for (const d of descriptors) {
        if (!d.capabilities?.length) continue;
        const actions = new Set((d.dataSources ?? []).map((dataSource) => dataSource.action));
        for (const capability of d.capabilities) {
          expect(
            actions.has(capability.action),
            `Integration "${d.id}" capability "${capability.id}" references missing action "${capability.action}"`
          ).toBe(true);
        }
      }
    });

    it("does not declare duplicate capability ids per integration", () => {
      for (const d of descriptors) {
        if (!d.capabilities?.length) continue;
        const ids = d.capabilities.map((capability) => capability.id);
        expect(ids, `Integration "${d.id}" has duplicate capability ids`).toEqual([
          ...new Set(ids),
        ]);
      }
    });

    it("no duplicate MCP tool names after namespacing", () => {
      const seen = new Set<string>();
      for (const d of descriptors) {
        for (const t of d.mcpTools ?? []) {
          const namespaced = `${d.id}__${t.name}`;
          expect(seen.has(namespaced), `Duplicate MCP tool: ${namespaced}`).toBe(false);
          seen.add(namespaced);
        }
      }
    });

    it("MCP connection serverName is unique", () => {
      const seen = new Set<string>();
      for (const d of descriptors) {
        if (!d.mcp) continue;
        expect(seen.has(d.mcp.serverName), `Duplicate MCP server name: ${d.mcp.serverName}`).toBe(
          false
        );
        seen.add(d.mcp.serverName);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Self-test: run conformance against a minimal valid descriptor
// ---------------------------------------------------------------------------

const MinimalIcon = () => null;

const MINIMAL_DESCRIPTOR: IntegrationDescriptor = {
  id: "test-integration",
  name: "Test Integration",
  description: "A test integration",
  icon: MinimalIcon,
  category: "analytics",
  auth: { id: "test", name: "Test", type: "none" },
};

runIntegrationConformance([MINIMAL_DESCRIPTOR]);
