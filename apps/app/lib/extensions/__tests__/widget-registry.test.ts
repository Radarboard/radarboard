import { isTemplateConfig, synchronizeTemplateConfig } from "@radarboard/widget-engine/templates";
import {
  DEFAULT_LAYOUT,
  GRID_SLOTS,
  WIDGET_REGISTRY,
} from "@radarboard/widget-engine/widgets/registry";
import { beforeAll, describe, expect, it } from "vitest";
import { initializeWidgets } from "../runtime/widgets-init";

beforeAll(() => {
  initializeWidgets();
});

type Auth = NonNullable<(typeof WIDGET_REGISTRY extends Map<string, infer V> ? V : never)["auth"]>;
type SingleAuth = Auth extends Array<infer A> ? A : Auth;

function assertAuthDeclaration(auth: SingleAuth) {
  expect(["api_key", "oauth", "none"]).toContain(auth.type);
  if (auth.type === "api_key") {
    expect(auth.fields).toBeDefined();
    expect(auth.fields?.length).toBeGreaterThan(0);
  }
  if (auth.type === "oauth" && auth.oauth) {
    expect(auth.oauth.provider).toBeTruthy();
    expect(auth.oauth.scopes).toBeDefined();
    expect(auth.fields).toBeDefined();
  }
}

describe("Widget Registry", () => {
  it("has all expected widgets registered", () => {
    const expectedIds = [
      "revenue",
      "shipping",
      "roadmap",
      "analytics",
      "seo",
      "observability",
      "sponsorship",
      "pulls",
      "github-commits",
      "github-stars",
      "npm-downloads",
      "bookmarks",
      "logs",
      "aso-keywords",
      "deployments",
      "projects",
      "builds",
      "vercel-domains",
      "app-reviews",
    ];
    const ids = Array.from(WIDGET_REGISTRY.keys());
    for (const widgetId of expectedIds) {
      expect(ids).toContain(widgetId);
    }
    expect(ids).toHaveLength(expectedIds.length);
  });

  it("has 9 grid slots", () => {
    expect(GRID_SLOTS).toHaveLength(9);
    expect(GRID_SLOTS[0]).toBe("slot1");
    expect(GRID_SLOTS[8]).toBe("slot9");
  });

  it("default layout is empty", () => {
    expect(DEFAULT_LAYOUT.slot1).toBeNull();
    expect(DEFAULT_LAYOUT.slot2).toBeNull();
    expect(DEFAULT_LAYOUT.slot3).toBeNull();
    expect(DEFAULT_LAYOUT.slot4).toBeNull();
    expect(DEFAULT_LAYOUT.slot5).toBeNull();
    expect(DEFAULT_LAYOUT.slot6).toBeNull();
    expect(DEFAULT_LAYOUT.slot7).toBeNull();
    expect(DEFAULT_LAYOUT.slot8).toBeNull();
    expect(DEFAULT_LAYOUT.slot9).toBeNull();
  });

  it("every widget has required fields", () => {
    for (const [id, descriptor] of WIDGET_REGISTRY) {
      expect(descriptor.id).toBe(id);
      expect(descriptor.name).toBeTruthy();
      expect(descriptor.description).toBeTruthy();
      expect(descriptor.component).toBeDefined();
      expect(descriptor.defaultSlot).toBeTruthy();
    }
  });

  it("every widget with auth has valid auth declarations", () => {
    for (const descriptor of WIDGET_REGISTRY.values()) {
      if (!descriptor.auth) continue;
      const authList = Array.isArray(descriptor.auth) ? descriptor.auth : [descriptor.auth];
      for (const auth of authList) assertAuthDeclaration(auth);
    }
  });

  it("every widget exposes a template visual editor with recipe metadata", () => {
    for (const descriptor of WIDGET_REGISTRY.values()) {
      expect(descriptor.visualEditor?.kind).toBe("template");

      const editorConfig = descriptor.visualEditor?.getConfig({
        projectSlug: null,
        projects: [],
        config: descriptor.defaultConfig,
      });

      expect(isTemplateConfig(editorConfig)).toBe(true);

      if (!isTemplateConfig(editorConfig)) continue;
      const normalized = synchronizeTemplateConfig(editorConfig);
      expect(normalized.recipe).toBeTruthy();
    }
  });

  it("no two default slot assignments conflict", () => {
    const slotAssignments = Object.entries(DEFAULT_LAYOUT)
      .filter(([, v]) => v !== null)
      .map(([, v]) => v);
    const unique = new Set(slotAssignments);
    expect(unique.size).toBe(slotAssignments.length);
  });
});
