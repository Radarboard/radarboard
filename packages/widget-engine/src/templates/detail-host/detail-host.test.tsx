// @vitest-environment jsdom

import { DashboardProvider } from "@radarboard/hooks/use-dashboard";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import { DialogBody, DialogHeader, DialogTitle } from "@radarboard/ui/app-dialog";
import { registerTemplateDataSource } from "@radarboard/widget-sdk/data-source-registry";
import { registerTemplateDetailRenderer } from "@radarboard/widget-sdk/detail-renderer-registry";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { TemplateWidget } from "../template-widget";
import type { WidgetTemplateConfig } from "../types";

function StaticResolver({
  onState,
}: {
  projectSlug: string | null;
  onState: (state: {
    data: unknown;
    fetchedAt: number | null;
    refetch: (() => Promise<void>) | null;
    loading: boolean;
    error: string | null;
  }) => void;
}) {
  useEffect(() => {
    onState({
      data: {
        items: [{ id: "alpha", name: "Alpha" }],
      },
      fetchedAt: 1_700_000_000,
      refetch: null,
      loading: false,
      error: null,
    });
  }, [onState]);

  return null;
}

registerTemplateDataSource("test-modal-prefs-resolver", StaticResolver);
registerTemplateDetailRenderer("test.modal-pref-detail", ({ item }) =>
  createElement(
    "div",
    null,
    createElement(DialogHeader, null, createElement(DialogTitle, null, "Test Detail")),
    createElement(
      DialogBody,
      null,
      createElement("div", null, `Detail ${(item as { name: string }).name}`)
    )
  )
);

const TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "test-modal-prefs-resolver" }],
  sections: [
    {
      type: "list",
      source: { sourceId: "test-modal-prefs-resolver", field: "items" },
      selection: {
        selectionId: "items.detail",
        keyField: "id",
        detailRendererId: "test.modal-pref-detail",
        dialog: { size: "sm", resizable: true },
      },
      itemTemplate: {
        title: { sourceId: "test-modal-prefs-resolver", field: "name" },
      },
    },
  ],
};

function Harness() {
  const [widgetLayoutConfig, setWidgetLayoutConfig] = useState<WidgetLayoutConfig>({
    configs: {},
    modalPrefs: {},
  });
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);

  return createElement(
    DashboardProvider,
    {
      projects: [],
      widgetLayoutConfig,
      onWidgetLayoutConfigChange: setWidgetLayoutConfig,
    },
    createElement(TemplateWidget, {
      widgetId: "test-widget",
      projectSlug: "goshuin-atlas",
      config: TEMPLATE_CONFIG,
      selectedDetailId,
      onSelectedDetailIdChange: setSelectedDetailId,
    })
  );
}

describe("TemplateDetailHost", () => {
  it("reopens template detail modals with the previously selected persisted size", async () => {
    render(createElement(Harness));

    fireEvent.click(await screen.findByRole("button", { name: "Alpha" }));

    fireEvent.click(await screen.findByRole("button", { name: "Large" }));
    expect(
      (await screen.findByRole("button", { name: "Large" })).getAttribute("aria-pressed")
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(await screen.findByRole("button", { name: "Alpha" }));

    expect(
      (await screen.findByRole("button", { name: "Large" })).getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByText("Detail Alpha")).toBeTruthy();
  });
});
