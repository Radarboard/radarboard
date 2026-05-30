// @vitest-environment jsdom
import { useCredentials } from "@radarboard/hooks/use-credentials";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { LayoutDefinition } from "@radarboard/types/database";
import { TooltipProvider } from "@radarboard/ui/tooltip";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectWidgetPlacementModal } from "../";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: vi.fn(),
  };
});

vi.mock("@radarboard/hooks/use-credentials", () => ({
  useCredentials: vi.fn(),
}));

vi.mock("@radarboard/hooks/dashboard-layout", () => ({
  createDefaultDashboardWidgetLayout: vi.fn((_layout: LayoutDefinition) => ({
    c1: "analytics",
    c2: "revenue",
    c3: null,
    c4: null,
  })),
  normalizeDashboardWidgetLayout: vi.fn(
    (_layout: LayoutDefinition, saved: Record<string, string | null>) => saved
  ),
}));

vi.mock("@radarboard/integration-sdk", () => ({
  getIntegration: vi.fn((id: string) => {
    const map: Record<string, { name: string }> = {
      openpanel: { name: "OpenPanel" },
      revenuecat: { name: "RevenueCat" },
      github: { name: "GitHub" },
    };
    return map[id] ?? undefined;
  }),
}));

vi.mock("@radarboard/widget-engine/widgets/registry", () => {
  const mockWidgets = new Map([
    [
      "analytics",
      {
        id: "analytics",
        name: "Analytics",
        description: "Visitor metrics, top pages, referrers, and traffic trends",
        requiredIntegrations: ["openPanel"],
        catalogCategory: "analytics",
        auth: [{ type: "oauth", id: "openpanel", name: "OpenPanel" }],
      },
    ],
    [
      "revenue",
      {
        id: "revenue",
        name: "Revenue",
        description: "Subscription revenue, MRR, and payment tracking",
        requiredIntegrations: ["revenuecat"],
        catalogCategory: "revenue",
        auth: [{ type: "api_key", id: "revenuecat", name: "RevenueCat" }],
      },
    ],
    [
      "github-stars",
      {
        id: "github-stars",
        name: "GitHub Stars",
        description: "Star counts, forks, and repository activity",
        requiredIntegrations: [],
        catalogCategory: "development",
        auth: [{ type: "oauth", id: "github", name: "GitHub" }],
      },
    ],
  ]);
  return { WIDGET_REGISTRY: mockWidgets };
});

vi.mock("@radarboard/widget-engine/layouts", () => ({
  getCellSlotName: vi.fn((index: number) => `slot${index + 1}`),
  getGridAreaName: vi.fn((id: string) => `area_${id}`),
  getSortedCells: vi.fn((cells: Array<{ id: string; rowStart: number; colStart: number }>) =>
    [...cells].sort((a, b) => {
      if (a.rowStart !== b.rowStart) return a.rowStart - b.rowStart;
      return a.colStart - b.colStart;
    })
  ),
  generateGridTemplateAreas: vi.fn(() => '"area_c1 area_c2" "area_c3 area_c4"'),
  resolveColSizes: vi.fn(() => [50, 50]),
  resolveRowSizes: vi.fn(() => [50, 50]),
  sizesToGridTemplate: vi.fn((sizes: number[]) => sizes.map((s) => `${s}fr`).join(" ")),
}));

vi.mock("@/components/shared/remote-service-icon", () => ({
  RemoteServiceIcon: ({ alt }: { alt: string }) =>
    createElement("span", { "data-testid": `service-icon-${alt}` }, alt),
}));

vi.mock("@/lib/service-favicons", () => ({
  getServiceFaviconUrl: vi.fn((_id: string) => "https://example.com/favicon.png"),
}));

/* ------------------------------------------------------------------ */
/*  Test Data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_LAYOUT: LayoutDefinition = {
  id: "test-layout",
  name: "Test 2x2",
  cells: [
    { id: "c1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "c2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "c3", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "c4", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
  ],
  colSizes: [50, 50],
  rowSizes: [50, 50],
};

const mockUpdateFn = vi.fn();

function renderModal(overrides: Partial<Parameters<typeof ProjectWidgetPlacementModal>[0]> = {}) {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    projectSlug: "my-project",
    projectName: "My Project",
    pageSlug: "overview",
    pageName: "Overview",
    layout: MOCK_LAYOUT,
    ...overrides,
  };
  return render(
    createElement(TooltipProvider, null, createElement(ProjectWidgetPlacementModal, defaultProps))
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("ProjectWidgetPlacementModal", () => {
  beforeEach(() => {
    vi.mocked(useDashboard).mockReturnValue({
      projectLayouts: {},
      updateProjectPageWidgetLayout: mockUpdateFn,
    } as unknown as ReturnType<typeof useDashboard>);

    vi.mocked(useCredentials).mockReturnValue({
      connectedKeys: ["openpanel"],
    } as unknown as ReturnType<typeof useCredentials>);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /* ----- Snapshot tests ----- */

  it("renders the modal with widget library and layout preview", () => {
    const { container } = renderModal();
    expect(container).toMatchSnapshot();
  });

  it("renders placed widgets using LibraryWidgetRow in grid cells", () => {
    renderModal();

    // The placed widgets should show name + description inside grid cells
    const analyticsNames = screen.getAllByText("Analytics");
    expect(analyticsNames.length).toBeGreaterThanOrEqual(1);

    const revenueNames = screen.getAllByText("Revenue");
    expect(revenueNames.length).toBeGreaterThanOrEqual(1);

    // Descriptions should be rendered for placed widgets
    expect(
      screen.getAllByText("Visitor metrics, top pages, referrers, and traffic trends").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Subscription revenue, MRR, and payment tracking").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders empty cells with drop here placeholder", () => {
    renderModal();

    // c3 and c4 are unassigned, so two "drop here" placeholders
    const dropPlaceholders = screen.getAllByText("drop here");
    expect(dropPlaceholders).toHaveLength(2);
  });

  /* ----- Behavioral tests ----- */

  it("hides assignment status in grid cell widgets", () => {
    renderModal();

    // "Placed on" text should appear in the sidebar library (not hidden) for assigned widgets
    const placedOnElements = screen.getAllByText(/Placed on/);
    expect(placedOnElements.length).toBeGreaterThanOrEqual(1);

    // The grid cells render with hideAssignment=true, so "Placed on" should NOT appear
    // multiple times for each widget. We check that it appears only in the sidebar (once per placed widget).
    // In the sidebar: analytics is placed on slot1, revenue on slot2
    expect(screen.getByText("Placed on slot1")).toBeTruthy();
    expect(screen.getByText("Placed on slot2")).toBeTruthy();
  });

  it("shows widget library with categorized widgets", () => {
    renderModal();

    // Category headers
    expect(screen.getByText("Revenue & Monetization")).toBeTruthy();
    expect(screen.getByText("Analytics & SEO")).toBeTruthy();
    expect(screen.getByText("Development")).toBeTruthy();

    // Widget names in the library
    expect(screen.getAllByText("Analytics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Revenue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("GitHub Stars").length).toBeGreaterThanOrEqual(1);
  });

  it("shows widget library header and count", () => {
    renderModal();

    expect(screen.getByText("Widget Library")).toBeTruthy();
    expect(screen.getByText("3 widgets")).toBeTruthy();
  });

  it("shows layout preview section", () => {
    renderModal();

    expect(screen.getByText("Layout Preview")).toBeTruthy();
  });

  it("shows remove confirmation when clicking X on a cell", async () => {
    renderModal();

    // Find the remove button for Analytics in slot1
    const removeButton = screen.getByRole("button", {
      name: "Remove Analytics from slot1",
    });
    fireEvent.click(removeButton);

    // The remove confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getAllByText("Remove Widget").length).toBeGreaterThanOrEqual(1);
    });

    // The "Remove widget" action button should be present
    expect(screen.getByText("Remove widget")).toBeTruthy();
    // Cancel button should be present
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("search filters widgets in the library", async () => {
    renderModal();

    const searchInput = screen.getByPlaceholderText("Search widgets…");
    fireEvent.change(searchInput, { target: { value: "star" } });

    await waitFor(() => {
      // Only GitHub Stars should remain visible in the library
      expect(screen.getByText("1 widget")).toBeTruthy();
    });

    // GitHub Stars should still be visible
    expect(screen.getAllByText("GitHub Stars").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Star counts, forks, and repository activity").length
    ).toBeGreaterThanOrEqual(1);

    // "Revenue & Monetization" and "Analytics & SEO" categories should be gone
    expect(screen.queryByText("Revenue & Monetization")).toBeNull();
    expect(screen.queryByText("Analytics & SEO")).toBeNull();
  });

  it("shows no widgets match message when search yields nothing", async () => {
    renderModal();

    const searchInput = screen.getByPlaceholderText("Search widgets…");
    fireEvent.change(searchInput, { target: { value: "zzz-nonexistent" } });

    await waitFor(() => {
      expect(screen.getByText("No widgets match that search yet.")).toBeTruthy();
    });

    expect(screen.getByText("0 widgets")).toBeTruthy();
  });

  it("bottom bar shows placed widget summary chips", () => {
    renderModal();

    // slot1 and slot2 appear both in the grid cell headers and in the bottom bar chips.
    // The bottom bar chips are buttons whose text content includes both the slot label
    // and the widget name. Verify at least one button combines "slot1" + "Analytics".
    const chipButtons = screen.getAllByRole("button");
    const analyticsChip = chipButtons.find(
      (btn) => btn.textContent?.includes("slot1") && btn.textContent?.includes("Analytics")
    );
    const revenueChip = chipButtons.find(
      (btn) => btn.textContent?.includes("slot2") && btn.textContent?.includes("Revenue")
    );
    expect(analyticsChip).toBeTruthy();
    expect(revenueChip).toBeTruthy();
  });

  it("shows the dialog title with project name and layout info", () => {
    renderModal();

    // "My Project" appears in both the title and the description; verify at least one
    const projectNameElements = screen.getAllByText("My Project");
    expect(projectNameElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Overview · Test 2x2 · 4 cells/)).toBeTruthy();
  });

  it("does not render when open is false", () => {
    renderModal({ open: false });

    expect(screen.queryByText("Widget Library")).toBeNull();
    expect(screen.queryByText("Layout Preview")).toBeNull();
  });

  it("bottom bar chip buttons are interactive", () => {
    renderModal();

    // Each bottom bar chip is a button with outline variant containing slot + widget name
    const chipButtons = screen.getAllByRole("button");
    const analyticsChip = chipButtons.find(
      (btn) => btn.textContent?.includes("slot1") && btn.textContent?.includes("Analytics")
    );
    const revenueChip = chipButtons.find(
      (btn) => btn.textContent?.includes("slot2") && btn.textContent?.includes("Revenue")
    );

    // Both chips should exist and be enabled
    expect(analyticsChip).toBeTruthy();
    expect(revenueChip).toBeTruthy();
    expect(analyticsChip!.getAttribute("disabled")).toBeNull();
    expect(revenueChip!.getAttribute("disabled")).toBeNull();

    // Each chip should contain an X icon (svg element) for removal
    expect(analyticsChip!.querySelector("svg")).toBeTruthy();
    expect(revenueChip!.querySelector("svg")).toBeTruthy();
  });
});
