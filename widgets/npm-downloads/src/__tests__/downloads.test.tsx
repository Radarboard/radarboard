// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";
import { downloadsDescriptor } from "..";

const mockUseSWR = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

describe("downloadsDescriptor", () => {
  beforeEach(() => {
    mockUseSWR.mockReset();
    mockUseSWR.mockReturnValue({
      data: {
        packages: [
          {
            name: "@radarboard/widget-engine",
            version: "1.2.3",
            weeklyDownloads: 1200,
            monthlyDownloads: 4800,
          },
        ],
        totalWeekly: 1200,
        totalMonthly: 4800,
        _fetchedAt: 1_700_000_000,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
    });
    localStorage.clear();
    window.open = vi.fn();
  });

  it("declares the npm integration dependency", () => {
    expect(downloadsDescriptor.requiredIntegrations).toEqual(["npm"]);
  });

  it("renders the compact widget with shared KPI cell and inline rows", async () => {
    render(createElement(downloadsDescriptor.component, { projectSlug: null, config: {} }));

    expect(await screen.findByText("Weekly Downloads")).toBeTruthy();
    expect(screen.getByText("Package")).toBeTruthy();
    expect(screen.getByText("Version")).toBeTruthy();
    expect(screen.getByText("Weekly")).toBeTruthy();
    expect(screen.getByText("@radarboard/widget-engine")).toBeTruthy();

    const row = screen.getByRole("button", { name: /@radarboard\/widget-engine/i });
    row.click();

    expect(window.open).toHaveBeenCalledWith(
      "https://www.npmjs.com/package/@radarboard/widget-engine",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("passes configured package filters to the compact layout resolver", () => {
    render(
      createElement(downloadsDescriptor.component, {
        projectSlug: null,
        config: {
          includePackages: ["skill-check", "gulp-json-concat"],
          excludePackages: ["zzz"],
        },
      })
    );

    expect(mockUseSWR.mock.calls[0]?.[0]).toBe(
      "/api/integrations/npm/data?include=skill-check&include=gulp-json-concat&exclude=zzz&range=30d"
    );
  });

  it("passes configured package filters to the expanded downloads fetch", () => {
    const ExpandedComponent = downloadsDescriptor.expandedComponent;

    if (!ExpandedComponent) {
      throw new Error("Expected downloadsDescriptor.expandedComponent to be defined");
    }

    render(
      createElement(ExpandedComponent, {
        projectSlug: null,
        config: {
          includePackages: ["skill-check", "gulp-json-concat"],
          excludePackages: ["zzz"],
        },
      })
    );

    expect(mockUseSWR.mock.calls[0]?.[0]).toBe(
      "/api/integrations/npm/data?include=skill-check&include=gulp-json-concat&exclude=zzz&range=30d"
    );
  });

  it("shows an empty state in expanded view when npm is not configured", async () => {
    mockUseSWR.mockReturnValue({
      data: {
        configured: false,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
    });

    const ExpandedComponent = downloadsDescriptor.expandedComponent;

    if (!ExpandedComponent) {
      throw new Error("Expected downloadsDescriptor.expandedComponent to be defined");
    }

    render(createElement(ExpandedComponent, { projectSlug: null, config: {} }));

    expect(await screen.findByText("No npm packages configured")).toBeTruthy();
  });

  it("reports disconnected chrome state when npm is not configured in compact mode", async () => {
    mockUseSWR.mockReturnValue({
      data: {
        configured: false,
        packages: [],
        totalWeekly: 0,
        totalMonthly: 0,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
    });

    const onChromeStateChange = vi.fn();

    render(
      createElement(downloadsDescriptor.component, {
        widgetId: "downloads",
        projectSlug: null,
        config: {},
        onChromeStateChange,
      })
    );

    expect(await screen.findByText("npm not connected")).toBeTruthy();
    await waitFor(() => {
      expect(onChromeStateChange).toHaveBeenCalledWith("disconnected");
    });
  });
});
