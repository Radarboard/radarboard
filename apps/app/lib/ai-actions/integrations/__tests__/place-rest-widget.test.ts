import { beforeEach, describe, expect, it, vi } from "vitest";

const executeConfigureWidget = vi.fn();
const executeAddWidget = vi.fn();

vi.mock("@/lib/ai-actions/dashboard/configure-widget", () => ({
  executeConfigureWidget: (p: unknown) => executeConfigureWidget(p),
}));
vi.mock("@/lib/ai-actions/dashboard/add-widget", () => ({
  executeAddWidget: (p: unknown) => executeAddWidget(p),
}));

import {
  buildGenericRestConfig,
  buildRestWidgetInstanceConfig,
  executePlaceRestWidget,
  REST_BINDING_VARIANT_ID,
} from "../place-rest-widget";

const SPEC = {
  integrationId: "acme",
  action: "summary",
  metrics: [{ label: "Users", field: "stats.users", format: "number" as const }],
  list: { field: "items", title: "name", subtitle: "role" },
};

beforeEach(() => {
  vi.clearAllMocks();
  executeConfigureWidget.mockResolvedValue({ configured: true, widgetId: "generic-rest" });
  executeAddWidget.mockResolvedValue({ added: true, widgetId: "generic-rest" });
});

describe("buildGenericRestConfig", () => {
  it("binds the integration + action and builds kpi + list sections", () => {
    const cfg = buildGenericRestConfig(SPEC);
    expect(cfg).toMatchObject({
      dataSources: [{ id: "generic-rest" }],
      integrationId: "acme",
      dataSourceAction: "summary",
    });
    const sections = cfg.sections as Array<{ type: string }>;
    expect(sections.map((s) => s.type)).toEqual(["kpi-row", "list"]);
  });

  it("defaults the action to 'data' and omits the kpi row when no metrics", () => {
    const cfg = buildGenericRestConfig({
      integrationId: "acme",
      list: { field: "items", title: "name" },
    });
    expect(cfg.dataSourceAction).toBe("data");
    const sections = cfg.sections as Array<{ type: string }>;
    expect(sections.map((s) => s.type)).toEqual(["list"]);
  });
});

describe("buildRestWidgetInstanceConfig", () => {
  it("wraps the binding as an active custom variant so the render pipeline applies it", () => {
    const cfg = buildRestWidgetInstanceConfig({ ...SPEC, name: "Acme" }) as {
      name?: string;
      activeVariant?: string;
      customVariants?: Array<{
        id: string;
        config: { integrationId?: string; dataSourceAction?: string };
      }>;
    };
    // Top-level name is kept for client-side descriptor registration.
    expect(cfg.name).toBe("Acme");
    // The binding is the ACTIVE variant — arbitrary top-level fields would be dropped by the render.
    expect(cfg.activeVariant).toBe(REST_BINDING_VARIANT_ID);
    expect(cfg.customVariants?.[0]?.id).toBe(REST_BINDING_VARIANT_ID);
    expect(cfg.customVariants?.[0]?.config.integrationId).toBe("acme");
    expect(cfg.customVariants?.[0]?.config.dataSourceAction).toBe("summary");
  });
});

describe("executePlaceRestWidget", () => {
  it("configures then places the widget and reports a dashboard change", async () => {
    const res = await executePlaceRestWidget(SPEC);
    expect(res).toEqual({ placed: true, widgetId: "rest-acme", dashboardChanged: true });
    expect(executeConfigureWidget).toHaveBeenCalledWith(
      expect.objectContaining({ widgetId: "rest-acme", mode: "replace" })
    );
    expect(executeAddWidget).toHaveBeenCalledWith(
      expect.objectContaining({ widgetId: "rest-acme" })
    );
  });

  it("rejects a missing integrationId before touching the dashboard", async () => {
    const res = await executePlaceRestWidget({ integrationId: " ", metrics: SPEC.metrics });
    expect(res.placed).toBe(false);
    expect(res.error).toMatch(/integrationId/);
    expect(executeConfigureWidget).not.toHaveBeenCalled();
  });

  it("rejects when there is nothing to display", async () => {
    const res = await executePlaceRestWidget({ integrationId: "acme" });
    expect(res.placed).toBe(false);
    expect(res.error).toMatch(/at least one metric or a list/);
    expect(executeConfigureWidget).not.toHaveBeenCalled();
  });

  it("stops and surfaces a config failure without placing", async () => {
    executeConfigureWidget.mockResolvedValue({ configured: false, error: "bad config" });
    const res = await executePlaceRestWidget(SPEC);
    expect(res).toEqual({ placed: false, widgetId: "rest-acme", error: "bad config" });
    expect(executeAddWidget).not.toHaveBeenCalled();
  });

  it("surfaces a placement failure", async () => {
    executeAddWidget.mockResolvedValue({ added: false, error: "no empty cell" });
    const res = await executePlaceRestWidget(SPEC);
    expect(res).toEqual({ placed: false, widgetId: "rest-acme", error: "no empty cell" });
  });
});
