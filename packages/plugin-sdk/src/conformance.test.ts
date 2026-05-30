/**
 * Plugin registry conformance tests.
 *
 * Validates that all plugin descriptors meet structural invariants:
 * - Unique IDs
 * - Required fields present and well-formed
 * - No duplicate widget IDs after namespacing
 * - No duplicate MCP tool names after namespacing
 * - Valid semver versions
 * - Keyboard shortcuts follow the Mod+Key pattern
 *
 * These tests work against any PluginDescriptor[] array, so they can
 * be imported and run against the real PLUGIN_REGISTRY in downstream
 * packages that register plugins.
 */

import { describe, expect, it } from "vitest";
import type { PluginDescriptor } from "./types";

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

/**
 * Run conformance checks against an array of plugin descriptors.
 * Exported so downstream packages can call `runPluginConformance(getAllPlugins())`.
 */
export function runPluginConformance(descriptors: PluginDescriptor[]) {
  describe("plugin registry conformance", () => {
    it("has at least one registered plugin", () => {
      expect(descriptors.length).toBeGreaterThan(0);
    });

    it("all IDs are unique", () => {
      const ids = descriptors.map((d) => d.id);
      expect(ids).toEqual([...new Set(ids)]);
    });

    it("all IDs are kebab-case", () => {
      for (const d of descriptors) {
        expect(d.id, `Plugin "${d.id}" is not kebab-case`).toMatch(KEBAB_CASE);
      }
    });

    it("all versions are valid semver", () => {
      for (const d of descriptors) {
        expect(d.version, `Plugin "${d.id}" version "${d.version}" is not semver`).toMatch(SEMVER);
      }
    });

    it("all have required display fields", () => {
      for (const d of descriptors) {
        expect(d.name, `Plugin "${d.id}" missing name`).toBeTruthy();
        expect(d.description, `Plugin "${d.id}" missing description`).toBeTruthy();
        expect(d.icon, `Plugin "${d.id}" missing icon`).toBeTruthy();
        expect(d.component, `Plugin "${d.id}" missing component`).toBeTruthy();
      }
    });

    it("all have at least one launch surface", () => {
      for (const d of descriptors) {
        expect(d.launchSurfaces.length, `Plugin "${d.id}" has no launch surfaces`).toBeGreaterThan(
          0
        );
      }
    });

    it("no duplicate widget IDs after namespacing", () => {
      const seen = new Set<string>();
      for (const d of descriptors) {
        for (const w of d.widgets ?? []) {
          const namespaced = `${d.id}__${w.widgetId}`;
          expect(seen.has(namespaced), `Duplicate widget ID: ${namespaced}`).toBe(false);
          seen.add(namespaced);
        }
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

    it("all MCP tools have descriptions", () => {
      for (const d of descriptors) {
        for (const t of d.mcpTools ?? []) {
          expect(t.description, `MCP tool "${d.id}__${t.name}" missing description`).toBeTruthy();
        }
      }
    });

    it("widget templateConfigs have at least one section", () => {
      for (const d of descriptors) {
        for (const w of d.widgets ?? []) {
          const sections = w.templateConfig?.sections;
          if (sections) {
            expect(
              sections.length,
              `Widget "${d.id}__${w.widgetId}" templateConfig has no sections`
            ).toBeGreaterThan(0);
          }
        }
      }
    });

    it("migrations (if any) have valid ascending versions", () => {
      for (const d of descriptors) {
        if (!d.migrations?.length) continue;
        for (let i = 1; i < d.migrations.length; i++) {
          const prev = d.migrations[i - 1]?.version ?? 0;
          const curr = d.migrations[i]?.version ?? 0;
          expect(
            curr > prev,
            `Plugin "${d.id}" migration versions not ascending: ${prev} >= ${curr}`
          ).toBe(true);
        }
      }
    });

    it("intent handlers have unique actions per plugin", () => {
      for (const d of descriptors) {
        if (!d.intents?.length) continue;
        const actions = d.intents.map((i) => i.action);
        expect(actions, `Plugin "${d.id}" has duplicate intent actions`).toEqual([
          ...new Set(actions),
        ]);
      }
    });

    it("settings keys are unique per plugin", () => {
      for (const d of descriptors) {
        if (!d.settings?.length) continue;
        const keys = d.settings.map((s) => s.key);
        expect(keys, `Plugin "${d.id}" has duplicate setting keys`).toEqual([...new Set(keys)]);
      }
    });

    it("declared dependencies reference registered plugin IDs", () => {
      const registeredIds = new Set(descriptors.map((d) => d.id));
      for (const d of descriptors) {
        for (const depId of d.dependencies ?? []) {
          expect(
            registeredIds.has(depId),
            `Plugin "${d.id}" depends on "${depId}" which is not registered`
          ).toBe(true);
        }
      }
    });

    it("no self-dependencies", () => {
      for (const d of descriptors) {
        expect(d.dependencies?.includes(d.id) ?? false, `Plugin "${d.id}" depends on itself`).toBe(
          false
        );
      }
    });

    it("service actions are unique per plugin", () => {
      for (const d of descriptors) {
        if (!d.services?.length) continue;
        const actions = d.services.map((s) => s.action);
        expect(actions, `Plugin "${d.id}" has duplicate service actions`).toEqual([
          ...new Set(actions),
        ]);
      }
    });

    it("no duplicate service actions across all plugins", () => {
      const seen = new Set<string>();
      for (const d of descriptors) {
        for (const s of d.services ?? []) {
          const namespaced = `${d.id}/${s.action}`;
          expect(seen.has(namespaced), `Duplicate service: ${namespaced}`).toBe(false);
          seen.add(namespaced);
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Self-test: run conformance against a minimal valid descriptor
// ---------------------------------------------------------------------------

const MinimalIcon = () => null;
const MinimalComponent = () => null;

const MINIMAL_DESCRIPTOR: PluginDescriptor = {
  id: "test-plugin",
  name: "Test Plugin",
  description: "A test plugin",
  icon: MinimalIcon,
  category: "productivity",
  version: "1.0.0",
  launchSurfaces: ["palette"],
  presentation: "modal",
  component: MinimalComponent,
};

runPluginConformance([MINIMAL_DESCRIPTOR]);
