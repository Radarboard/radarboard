// @vitest-environment jsdom

import {
  registerTemplateDataSource,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactElement, useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

interface ResolverProps {
  projectSlug: string | null;
  onState: (state: {
    data: unknown;
    fetchedAt: number | null;
    refetch: (() => Promise<void>) | null;
    loading: boolean;
    error: string | null;
  }) => void;
}

afterEach(() => {
  cleanup();
});

function createStaticResolver({
  data,
  fetchedAt = 1_700_000_000,
  refetch = null,
  loading = false,
  error = null,
}: {
  data: unknown;
  fetchedAt?: number | null;
  refetch?: (() => Promise<void>) | null;
  loading?: boolean;
  error?: string | null;
}) {
  return function StaticResolver({ onState }: ResolverProps): ReactElement | null {
    useEffect(() => {
      onState({ data, fetchedAt, refetch, loading, error });
    }, [onState]);

    return null;
  };
}

function renderTemplate(
  config: WidgetTemplateConfig,
  options?: {
    onFetchedAt?: (value: number | null) => void;
    onRefetch?: (fn: (() => Promise<void>) | null) => void;
    onChromeStateChange?: (status: "default" | "disconnected") => void;
    onConnectService?: (serviceId: string) => void;
  }
) {
  return render(
    createElement(TemplateWidget, {
      projectSlug: "test-project",
      config,
      onFetchedAt: options?.onFetchedAt,
      onRefetch: options?.onRefetch,
      onChromeStateChange: options?.onChromeStateChange,
      onConnectService: options?.onConnectService,
    })
  );
}

describe("configured: false flow", () => {
  it("shows WidgetNotConfigured when resolver reports configured: false", async () => {
    const onChromeStateChange = vi.fn();

    registerTemplateDataSource(
      "github-stars",
      createStaticResolver({
        data: { configured: false },
        fetchedAt: null,
        loading: false,
        error: null,
      })
    );

    renderTemplate(
      {
        dataSources: [{ id: "github-stars" }],
        sections: [],
      },
      { onChromeStateChange, onConnectService: vi.fn() }
    );

    await waitFor(() => {
      expect(screen.getByText("GitHub not connected")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Connect GitHub" })).toBeTruthy();
    expect(onChromeStateChange).toHaveBeenCalledWith("disconnected");
  });

  it("shows WidgetNotConfigured when resolver reports null data and error", async () => {
    registerTemplateDataSource(
      "sentry",
      createStaticResolver({
        data: null,
        fetchedAt: null,
        loading: false,
        error: "401 Unauthorized",
      })
    );

    renderTemplate(
      {
        dataSources: [{ id: "sentry" }],
        sections: [],
      },
      { onConnectService: vi.fn() }
    );

    await waitFor(() => {
      expect(screen.getByText("Sentry not connected")).toBeTruthy();
    });
  });

  it("shows normal content when resolver reports configured: true", async () => {
    const onChromeStateChange = vi.fn();

    registerTemplateDataSource(
      "test-cfg-configured-ok",
      createStaticResolver({
        data: {
          configured: true,
          items: [{ id: "1", title: "Test Item" }],
        },
        fetchedAt: 1_700_000_000,
        loading: false,
        error: null,
      })
    );

    renderTemplate(
      {
        dataSources: [{ id: "test-cfg-configured-ok" }],
        sections: [
          {
            type: "list",
            source: { sourceId: "test-cfg-configured-ok", field: "items" },
            itemTemplate: {
              title: { sourceId: "test-cfg-configured-ok", field: "title" },
            },
          },
        ],
      },
      { onChromeStateChange }
    );

    await screen.findByText("Test Item");
    expect(screen.queryAllByText(/not connected/i)).toHaveLength(0);
    expect(onChromeStateChange).toHaveBeenCalledWith("default");
  });

  it("reports fetchedAt as null when any source is unconfigured", async () => {
    registerTemplateDataSource(
      "test-cfg-src-ok",
      createStaticResolver({
        data: { configured: true, value: 1 },
        fetchedAt: 100,
      })
    );
    registerTemplateDataSource(
      "test-cfg-src-bad",
      createStaticResolver({
        data: { configured: false },
        fetchedAt: null,
      })
    );

    const onFetchedAt = vi.fn();

    renderTemplate(
      {
        dataSources: [{ id: "test-cfg-src-ok" }, { id: "test-cfg-src-bad" }],
        sections: [],
      },
      { onFetchedAt, onConnectService: vi.fn() }
    );

    await waitFor(() => {
      expect(onFetchedAt).toHaveBeenCalledWith(null);
    });
  });

  it("does not show loading shimmer after unconfigured resolves", async () => {
    function DelayedUnconfiguredResolver({ onState }: ResolverProps): ReactElement | null {
      const [reported, setReported] = useState(false);

      useEffect(() => {
        if (!reported) {
          onState({ data: null, fetchedAt: null, refetch: null, loading: true, error: null });
          queueMicrotask(() => {
            onState({
              data: { configured: false },
              fetchedAt: null,
              refetch: null,
              loading: false,
              error: null,
            });
            setReported(true);
          });
        }
      }, [onState, reported]);

      return null;
    }

    registerTemplateDataSource("test-cfg-delayed-uncfg", DelayedUnconfiguredResolver);

    renderTemplate(
      {
        dataSources: [{ id: "test-cfg-delayed-uncfg" }],
        sections: [],
      },
      { onConnectService: vi.fn() }
    );

    await waitFor(() => {
      expect(screen.getByText("Service not connected")).toBeTruthy();
    });

    // Verify no shimmer is still showing — the CTA replaced it
    expect(screen.queryByTestId("skeleton-shimmer")).toBeNull();
  });

  it("shows a connect CTA for multi-provider widgets using an integrations chooser target", async () => {
    registerTemplateDataSource(
      "analytics",
      createStaticResolver({
        data: { configured: false },
        fetchedAt: null,
        loading: false,
        error: null,
      })
    );

    renderTemplate(
      {
        dataSources: [{ id: "analytics" }],
        sections: [],
      },
      { onConnectService: vi.fn() }
    );

    await waitFor(() => {
      expect(screen.getByText("Analytics not connected")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Connect Analytics" })).toBeTruthy();
  });

  it("routes analytics connect CTA to the integrations chooser without a service deep link", async () => {
    registerTemplateDataSource(
      "analytics",
      createStaticResolver({
        data: { configured: false },
        fetchedAt: null,
        loading: false,
        error: null,
      })
    );

    const onConnectService = vi.fn();
    renderTemplate(
      {
        dataSources: [{ id: "analytics" }],
        sections: [],
      },
      { onConnectService }
    );

    const button = await screen.findByRole("button", { name: "Connect Analytics" });
    await userEvent.click(button);

    expect(onConnectService).toHaveBeenCalledWith("intent:analytics");
  });

  it("routes npm downloads connect CTA to the npm integrations modal", async () => {
    registerTemplateDataSource(
      "npm-downloads",
      createStaticResolver({
        data: { configured: false },
        fetchedAt: null,
        loading: false,
        error: null,
      })
    );

    const onConnectService = vi.fn();
    renderTemplate(
      {
        dataSources: [{ id: "npm-downloads" }],
        sections: [],
      },
      { onConnectService }
    );

    const button = await screen.findByRole("button", { name: "Connect npm" });
    await userEvent.click(button);

    expect(onConnectService).toHaveBeenCalledWith("npm");
  });

  it("renders a project-settings CTA for mapping-required analytics state", async () => {
    registerTemplateDataSource(
      "analytics",
      createStaticResolver({
        data: {
          configured: false,
          ctaLabel: "Open Project Settings",
          ctaTarget: "intent:openpanel-project",
          projectMappingRequired: true,
          setupMessage:
            "OpenPanel is connected, but no project is linked yet. Select an OpenPanel project in Project Settings.",
        },
        fetchedAt: null,
        loading: false,
        error: null,
      })
    );

    const onConnectService = vi.fn();
    renderTemplate(
      {
        dataSources: [{ id: "analytics" }],
        sections: [],
      },
      { onConnectService }
    );

    expect(
      await screen.findByText(
        "OpenPanel is connected, but no project is linked yet. Select an OpenPanel project in Project Settings."
      )
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Open Project Settings" }));
    expect(onConnectService).toHaveBeenCalledWith("intent:openpanel-project");
  });
});
