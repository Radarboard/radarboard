// @vitest-environment jsdom

import { DialogBody, DialogHeader, DialogTitle } from "@radarboard/ui/app-dialog";
import {
  createRailContentRecipe,
  createSummaryContentRecipe,
  registerTemplateDataSource,
  registerTemplateDetailRenderer,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactElement, useCallback, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
});

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
    selectedDetailId?: string | null;
    onSelectedDetailIdChange?: (id: string | null) => void;
  }
) {
  return render(
    createElement(TemplateWidget, {
      projectSlug: "goshuin-atlas",
      config,
      onFetchedAt: options?.onFetchedAt,
      onRefetch: options?.onRefetch,
      selectedDetailId: options?.selectedDetailId,
      onSelectedDetailIdChange: options?.onSelectedDetailIdChange,
    })
  );
}

describe("TemplateWidget conformance", () => {
  it("aggregates fetchedAt and refetch across data sources", async () => {
    const refetchA = vi.fn(async () => {});
    const refetchB = vi.fn(async () => {});
    const onFetchedAt = vi.fn();
    const onRefetch = vi.fn();

    registerTemplateDataSource(
      "test-resolver-a",
      createStaticResolver({ data: { value: 1 }, fetchedAt: 100, refetch: refetchA })
    );
    registerTemplateDataSource(
      "test-resolver-b",
      createStaticResolver({ data: { value: 2 }, fetchedAt: 200, refetch: refetchB })
    );

    renderTemplate(
      {
        dataSources: [{ id: "test-resolver-a" }, { id: "test-resolver-b" }],
        sections: [],
      },
      { onFetchedAt, onRefetch }
    );

    await waitFor(() => expect(onFetchedAt).toHaveBeenCalledWith(100));
    await waitFor(() => expect(onRefetch).toHaveBeenLastCalledWith(expect.any(Function)));

    const aggregatedRefetch = onRefetch.mock.calls.at(-1)?.[0] as () => Promise<void>;
    await aggregatedRefetch();

    expect(refetchA).toHaveBeenCalledOnce();
    expect(refetchB).toHaveBeenCalledOnce();
  });

  it("keeps resolver state callbacks stable across parent rerenders", async () => {
    const effectRuns = vi.fn();
    const refetch = vi.fn(async () => {});

    function CountingResolver({ onState }: ResolverProps): ReactElement | null {
      useEffect(() => {
        effectRuns();
        onState({
          data: { value: 1 },
          fetchedAt: 100,
          refetch,
          loading: false,
          error: null,
        });
      }, [onState]);

      return null;
    }

    registerTemplateDataSource("test-stable-resolver-callback", CountingResolver);

    function Harness(): ReactElement {
      const [registrations, setRegistrations] = useState(0);
      const handleRefetch = useCallback((fn: (() => Promise<void>) | null) => {
        if (!fn) return;
        setRegistrations((current) => current + 1);
      }, []);

      return (
        <>
          <span data-testid="stable-callback-registrations">{registrations}</span>
          <TemplateWidget
            projectSlug="goshuin-atlas"
            config={{
              dataSources: [{ id: "test-stable-resolver-callback" }],
              sections: [],
            }}
            onRefetch={handleRefetch}
          />
        </>
      );
    }

    render(<Harness />);

    await waitFor(() =>
      expect(screen.getByTestId("stable-callback-registrations").textContent).toBe("1")
    );

    expect(effectRuns).toHaveBeenCalledTimes(1);
  });

  it("does not re-register refetch when source data changes but refetch stays the same", async () => {
    const refetch = vi.fn(async () => {});

    function ChangingDataResolver({ onState }: ResolverProps): ReactElement | null {
      const [value, setValue] = useState(0);

      useEffect(() => {
        onState({
          data: { value },
          fetchedAt: value,
          refetch,
          loading: false,
          error: null,
        });

        if (value === 0) {
          setValue(1);
        }
      }, [onState, value]);

      return null;
    }

    registerTemplateDataSource("test-stable-aggregated-refetch", ChangingDataResolver);

    function Harness(): ReactElement {
      const [registrations, setRegistrations] = useState(0);
      const [latestFetchedAt, setLatestFetchedAt] = useState<number | null>(null);
      const handleRefetch = useCallback((fn: (() => Promise<void>) | null) => {
        if (!fn) return;
        setRegistrations((current) => current + 1);
      }, []);
      const handleFetchedAt = useCallback((value: number | null) => {
        if (value == null) return;
        setLatestFetchedAt(value);
      }, []);

      return (
        <>
          <span data-testid="stable-refetch-registrations">{registrations}</span>
          <span data-testid="stable-refetch-fetched-at">{latestFetchedAt ?? "null"}</span>
          <TemplateWidget
            projectSlug="goshuin-atlas"
            config={{
              dataSources: [{ id: "test-stable-aggregated-refetch" }],
              sections: [],
            }}
            onFetchedAt={handleFetchedAt}
            onRefetch={handleRefetch}
          />
        </>
      );
    }

    render(<Harness />);

    await waitFor(() =>
      expect(screen.getByTestId("stable-refetch-fetched-at").textContent).toBe("1")
    );

    expect(screen.getByTestId("stable-refetch-registrations").textContent).toBe("1");
  });

  it("ignores structurally equal resolver payloads even when fresh objects are reported", async () => {
    const effectRuns = vi.fn();

    function UnstableEqualResolver({ onState }: ResolverProps): ReactElement | null {
      const [tick, setTick] = useState(0);

      useEffect(() => {
        effectRuns();
        onState({
          data: { items: [] },
          fetchedAt: null,
          refetch: null,
          loading: false,
          error: null,
        });
        if (tick === 0) setTick(1);
      }, [onState, tick]);

      return null;
    }

    registerTemplateDataSource("test-structural-dedupe", UnstableEqualResolver);

    renderTemplate({
      dataSources: [{ id: "test-structural-dedupe" }],
      sections: [],
    });

    await waitFor(() => expect(effectRuns).toHaveBeenCalled());
    await waitFor(() => expect(effectRuns.mock.calls.length).toBeLessThanOrEqual(3));
  });

  it("renders alert, KPI, and item-relative list data from a template resolver", async () => {
    // Recharts warns about zero-width charts in JSDOM — expected in headless tests
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    registerTemplateDataSource(
      "test-revenue-sections",
      createStaticResolver({
        data: {
          change: -12,
          grossRevenue: {
            value: 10,
            currency: "CAD",
            sparklineData: [{ value: 1 }, { value: 2 }],
          },
          payments: [
            {
              id: "pay_1",
              projectName: "Goshuin Atlas",
              country: "Japan",
              amount: 12.5,
              currency: "CAD",
              timeAgo: "2h ago",
            },
          ],
        },
      })
    );

    const { container } = renderTemplate({
      dataSources: [{ id: "test-revenue-sections" }],
      sections: [
        {
          type: "alert",
          severity: "warning",
          source: { sourceId: "test-revenue-sections", field: "" },
          condition: {
            source: { sourceId: "test-revenue-sections", field: "change" },
            operator: "lt",
            value: 0,
          },
          message: "Revenue changed {{change}}%",
        },
        {
          type: "kpi-row",
          columns: 1,
          metrics: [
            {
              label: "Gross Revenue",
              source: {
                sourceId: "test-revenue-sections",
                field: "grossRevenue.value",
                format: "currency",
              },
              sparklineSource: {
                sourceId: "test-revenue-sections",
                field: "grossRevenue.sparklineData",
              },
            },
          ],
        },
        {
          type: "list",
          source: { sourceId: "test-revenue-sections", field: "payments" },
          itemTemplate: {
            title: { sourceId: "test-revenue-sections", field: "projectName" },
            subtitle: { sourceId: "test-revenue-sections", field: "country" },
            value: { sourceId: "test-revenue-sections", field: "amount", format: "currency" },
            timestamp: {
              sourceId: "test-revenue-sections",
              field: "timeAgo",
              format: "relative-time",
            },
          },
        },
      ],
    });

    await screen.findByText("Revenue changed -12%");
    expect(screen.getByText("Gross Revenue")).toBeTruthy();
    expect(screen.getAllByText("CA$10")[0]).toBeTruthy();
    expect(screen.getByText("Goshuin Atlas")).toBeTruthy();
    expect(screen.getByText("Japan")).toBeTruthy();
    expect(screen.getByText("CA$12.50")).toBeTruthy();
    expect(screen.getByText("2h ago")).toBeTruthy();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders tabs with table and list sections from shared resolver data", async () => {
    registerTemplateDataSource(
      "test-tabbed-sections",
      createStaticResolver({
        data: {
          pages: [
            {
              path: "/home",
              sessions: 42,
              bounceRate: 51.2,
              currency: "USD",
            },
          ],
          referrers: [{ id: "search", name: "Search", sessions: 9 }],
        },
      })
    );

    renderTemplate({
      dataSources: [{ id: "test-tabbed-sections" }],
      sections: [
        {
          type: "tabs",
          defaultTab: "pages",
          tabs: [
            {
              id: "pages",
              label: "Pages",
              sections: [
                {
                  type: "table",
                  source: { sourceId: "test-tabbed-sections", field: "pages" },
                  columns: [
                    { key: "path", header: "Page", sortable: true },
                    { key: "sessions", header: "Sessions", sortable: true, format: "number" },
                    { key: "bounceRate", header: "Bounce", sortable: true, format: "percent" },
                  ],
                },
              ],
            },
            {
              id: "referrers",
              label: "Referrers",
              sections: [
                {
                  type: "list",
                  source: { sourceId: "test-tabbed-sections", field: "referrers" },
                  itemTemplate: {
                    title: { sourceId: "test-tabbed-sections", field: "name" },
                    value: {
                      sourceId: "test-tabbed-sections",
                      field: "sessions",
                      format: "number",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    await screen.findByText("/home");
    expect(screen.getByText("Sessions")).toBeTruthy();
    expect(screen.getByText("51%")).toBeTruthy();

    expect(screen.getByRole("tab", { name: "Pages" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Referrers" })).toBeTruthy();
  });

  it("renders a split layout recipe with an optional left rail", async () => {
    registerTemplateDataSource(
      "test-rail-recipe",
      createStaticResolver({
        data: {
          unresolvedCount: 3,
          errorTrend: [
            { date: "2026-03-17", value: 2 },
            { date: "2026-03-18", value: 4 },
          ],
          issues: [
            {
              id: "issue_1",
              title: "OAuth callback failed",
              culprit: "app/api/auth/oauth/route.ts",
              count: 12,
            },
          ],
        },
      })
    );

    renderTemplate({
      dataSources: [{ id: "test-rail-recipe" }],
      sections: createRailContentRecipe({
        rail: [
          {
            type: "headline-stat",
            source: { sourceId: "test-rail-recipe", field: "unresolvedCount", format: "number" },
            label: "issues",
            indicatorColor: "#e05555",
          },
          {
            type: "chart",
            variant: "line",
            source: { sourceId: "test-rail-recipe", field: "errorTrend" },
            xKey: "date",
            yKey: "value",
            height: 120,
            color: "#e05555",
          },
        ],
        content: {
          type: "list",
          source: { sourceId: "test-rail-recipe", field: "issues" },
          emptyMessage: "No issues",
          itemTemplate: {
            title: { sourceId: "test-rail-recipe", field: "title" },
            subtitle: { sourceId: "test-rail-recipe", field: "culprit" },
            value: { sourceId: "test-rail-recipe", field: "count", format: "number" },
          },
        },
      }),
    });

    await screen.findByText("issues");
    expect(screen.getByText("OAuth callback failed")).toBeTruthy();
    expect(screen.getByText("app/api/auth/oauth/route.ts")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("renders a summary-content recipe from reusable layout nodes", async () => {
    registerTemplateDataSource(
      "test-summary-recipe",
      createStaticResolver({
        data: {
          visitors: 1234,
          sessions: 2345,
          pages: [{ id: "page_1", path: "/home", sessions: 42 }],
        },
      })
    );

    renderTemplate({
      dataSources: [{ id: "test-summary-recipe" }],
      sections: createSummaryContentRecipe({
        summary: [
          {
            type: "kpi-row",
            columns: 2,
            variant: "compact",
            metrics: [
              {
                label: "Visitors",
                source: { sourceId: "test-summary-recipe", field: "visitors", format: "number" },
              },
              {
                label: "Sessions",
                source: { sourceId: "test-summary-recipe", field: "sessions", format: "number" },
              },
            ],
          },
        ],
        content: {
          type: "list",
          source: { sourceId: "test-summary-recipe", field: "pages" },
          itemTemplate: {
            title: { sourceId: "test-summary-recipe", field: "path" },
            value: { sourceId: "test-summary-recipe", field: "sessions", format: "number" },
          },
        },
      }),
    });

    await screen.findByText("Visitors");
    expect(screen.getAllByText("Sessions").length).toBeGreaterThan(0);
    expect(screen.getAllByText("/home").length).toBeGreaterThan(0);
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
  });

  it("shows the chart empty state when a chart source resolves to no rows", async () => {
    registerTemplateDataSource(
      "test-empty-chart",
      createStaticResolver({
        data: {
          trend: [],
        },
      })
    );

    renderTemplate({
      dataSources: [{ id: "test-empty-chart" }],
      sections: [
        {
          type: "chart",
          variant: "line",
          source: { sourceId: "test-empty-chart", field: "trend" },
          xKey: "date",
          yKey: "value",
        },
      ],
    });

    await screen.findByText("No data");
  });

  it("renders a row-list section with badge, timestamp, and severity icon status", async () => {
    registerTemplateDataSource(
      "test-row-list",
      createStaticResolver({
        data: {
          issues: [
            {
              id: "issue_1",
              level: "error",
              title: "OAuth callback failed",
              projectSlug: "goshuin-atlas",
              projectColor: "#ff4f6d",
              culprit: "app/api/auth/oauth/route.ts",
              count: 12,
              lastSeen: new Date(Date.now() - 3_600_000).toISOString(),
              permalink: "https://sentry.io/issues/issue_1",
            },
          ],
        },
      })
    );

    renderTemplate({
      dataSources: [{ id: "test-row-list" }],
      sections: [
        {
          type: "row-list",
          source: { sourceId: "test-row-list", field: "issues" },
          hrefSource: { sourceId: "test-row-list", field: "permalink" },
          itemTemplate: {
            status: {
              source: { sourceId: "test-row-list", field: "level" },
              display: "severity-icon",
            },
            title: { sourceId: "test-row-list", field: "title" },
            badge: {
              label: { sourceId: "test-row-list", field: "projectSlug" },
              color: { sourceId: "test-row-list", field: "projectColor" },
            },
            subtitle: { sourceId: "test-row-list", field: "culprit" },
            value: { sourceId: "test-row-list", field: "count", format: "number" },
            timestamp: { sourceId: "test-row-list", field: "lastSeen", format: "relative-time" },
          },
        },
      ],
    });

    await screen.findAllByText("OAuth callback failed");
    expect(screen.getByText("goshuin-atlas")).toBeTruthy();
    expect(screen.getAllByText("app/api/auth/oauth/route.ts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("12").length).toBeGreaterThan(0);
    expect(screen.getByTitle("error")).toBeTruthy();
  });

  it("normalizes compact-project badges from project names in row-list sections", async () => {
    registerTemplateDataSource(
      "test-row-list-project-name-badge",
      createStaticResolver({
        data: {
          items: [
            {
              id: "issue_2",
              title: "Shipping entry",
              projectName: "Pixel Studio",
              projectColor: "#ff4f6d",
            },
          ],
        },
      })
    );

    renderTemplate({
      dataSources: [{ id: "test-row-list-project-name-badge" }],
      sections: [
        {
          type: "row-list",
          source: { sourceId: "test-row-list-project-name-badge", field: "items" },
          itemTemplate: {
            title: { sourceId: "test-row-list-project-name-badge", field: "title" },
            badge: {
              label: { sourceId: "test-row-list-project-name-badge", field: "projectName" },
              color: { sourceId: "test-row-list-project-name-badge", field: "projectColor" },
              normalize: "compact-project",
            },
          },
        },
      ],
    });

    await screen.findByText("Shipping entry");
    expect(screen.getByText("pixel-studio")).toBeTruthy();
  });

  it("normalizes compact-project badges from project names in list sections", async () => {
    registerTemplateDataSource(
      "test-list-project-name-badge",
      createStaticResolver({
        data: {
          items: [
            {
              id: "repo_1",
              title: "Repo row",
              projectName: "Pixel Studio",
              projectColor: "#ff4f6d",
            },
          ],
        },
      })
    );

    renderTemplate({
      dataSources: [{ id: "test-list-project-name-badge" }],
      sections: [
        {
          type: "list",
          source: { sourceId: "test-list-project-name-badge", field: "items" },
          itemTemplate: {
            title: { sourceId: "test-list-project-name-badge", field: "title" },
            badge: {
              label: { sourceId: "test-list-project-name-badge", field: "projectName" },
              color: { sourceId: "test-list-project-name-badge", field: "projectColor" },
              normalize: "compact-project",
            },
          },
        },
      ],
    });

    expect((await screen.findAllByText("Repo row")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("pixel-studio")).length).toBeGreaterThan(0);
  });

  it("preserves non-compact badge labels in list sections", async () => {
    registerTemplateDataSource(
      "test-list-plain-badge",
      createStaticResolver({
        data: {
          items: [
            {
              id: "repo_2",
              title: "Repo row",
              label: "Pixel Studio",
              projectColor: "#ff4f6d",
            },
          ],
        },
      })
    );

    renderTemplate({
      dataSources: [{ id: "test-list-plain-badge" }],
      sections: [
        {
          type: "list",
          source: { sourceId: "test-list-plain-badge", field: "items" },
          itemTemplate: {
            title: { sourceId: "test-list-plain-badge", field: "title" },
            badge: {
              label: { sourceId: "test-list-plain-badge", field: "label" },
              color: { sourceId: "test-list-plain-badge", field: "projectColor" },
            },
          },
        },
      ],
    });

    expect((await screen.findAllByText("Repo row")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Pixel Studio")).length).toBeGreaterThan(0);
  });

  it("dispatches selection ids and renders registry-backed detail content", async () => {
    const onSelectedDetailIdChange = vi.fn();

    registerTemplateDataSource(
      "test-selectable-list",
      createStaticResolver({
        data: {
          payments: [
            {
              id: "pay_1",
              projectName: "Goshuin Atlas",
              amount: 12.5,
              currency: "CAD",
            },
          ],
        },
      })
    );

    registerTemplateDetailRenderer("test.payment-detail", ({ item }) =>
      createElement(
        "div",
        null,
        createElement(DialogHeader, null, createElement(DialogTitle, null, "Payment Detail")),
        createElement(DialogBody, null, `Selected payment: ${(item as { id: string }).id}`)
      )
    );

    const config: WidgetTemplateConfig = {
      dataSources: [{ id: "test-selectable-list" }],
      sections: [
        {
          type: "list",
          source: { sourceId: "test-selectable-list", field: "payments" },
          selection: {
            selectionId: "payment",
            keyField: "id",
            detailRendererId: "test.payment-detail",
          },
          itemTemplate: {
            title: { sourceId: "test-selectable-list", field: "projectName" },
            value: { sourceId: "test-selectable-list", field: "amount", format: "currency" },
          },
        },
      ],
    };

    const view = renderTemplate(config, { onSelectedDetailIdChange });

    await screen.findAllByText("Goshuin Atlas");
    fireEvent.click(screen.getByRole("button", { name: /Goshuin Atlas/i }));
    expect(onSelectedDetailIdChange).toHaveBeenCalledWith("payment:pay_1");

    view.rerender(
      createElement(TemplateWidget, {
        projectSlug: "goshuin-atlas",
        config,
        selectedDetailId: "payment:pay_1",
        onSelectedDetailIdChange,
      })
    );

    await screen.findByText("Selected payment: pay_1");
  });
});
