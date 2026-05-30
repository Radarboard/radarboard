// @vitest-environment jsdom
import type { AppStoreOverview } from "@radarboard/types/app-store-connect";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../../observability/src/data-resolver";
import { reviewPulseDescriptor } from "..";

const mockUseAppStore = vi.fn();

vi.mock("../../observability/hooks/use-app-store", () => ({
  useAppStore: (...args: unknown[]) => mockUseAppStore(...args),
}));

vi.mock("../../../observability/src/hooks/use-app-store", () => ({
  useAppStore: (...args: unknown[]) => mockUseAppStore(...args),
}));

const FIXTURE: AppStoreOverview = {
  appName: "Goshuin Atlas",
  bundleId: "dev.radarboard.goshuin",
  averageRating: 4.7,
  totalReviews: 152,
  reviewSummary: {
    text: "Users praise the design, but some mention onboarding friction in the latest release.",
    territory: "USA",
    platform: "IOS",
    createdAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
  latestVersion: "1.2.3",
  latestVersionState: "Ready for Sale",
  latestVersionCreatedAt: new Date(Date.now() - 86_400_000).toISOString(),
  recentNegativeReviews: 1,
  recentPositiveReviews: 12,
  releaseRisk: "elevated",
  recentReviews: [
    {
      id: "review_1",
      rating: 5,
      title: "Excellent shrine tracker",
      body: "The latest version is fast and reliable.",
      reviewer: "david",
      createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      territory: "CA",
    },
  ],
};

describe("reviewPulseDescriptor", () => {
  beforeEach(() => {
    mockUseAppStore.mockReturnValue({
      data: FIXTURE,
      configured: true,
      fetchedAt: 1_700_000_000,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
  });

  it("declares the appStoreConnect integration dependency", () => {
    expect(reviewPulseDescriptor.requiredIntegrations).toEqual(["appStoreConnect"]);
  });

  it("renders a standalone App Store review surface", { timeout: 15_000 }, async () => {
    render(
      createElement(reviewPulseDescriptor.component, {
        widgetId: reviewPulseDescriptor.id,
        projectSlug: "goshuin-atlas",
        config: {},
      })
    );

    expect(await screen.findByText("App Reviews")).toBeTruthy();
    expect(screen.getByText("Rating")).toBeTruthy();
    expect(screen.getByText("Excellent shrine tracker")).toBeTruthy();
  });

  it("shows a project-settings CTA when App Store Connect credentials exist but no app is linked", async () => {
    const onConnectService = vi.fn();
    mockUseAppStore.mockReturnValue({
      data: {
        configured: false,
        ctaLabel: "Open Project Settings",
        ctaTarget: "intent:app-store-connect-project",
        projectMappingRequired: true,
        setupMessage:
          "App Store Connect is connected, but no app is linked yet. Add an App ID in Project Settings.",
      },
      configured: false,
      fetchedAt: null,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });

    render(
      createElement(reviewPulseDescriptor.component, {
        widgetId: reviewPulseDescriptor.id,
        projectSlug: "goshuin-atlas",
        config: {},
        onConnectService,
      })
    );

    expect(
      await screen.findByText(
        "App Store Connect is connected, but no app is linked yet. Add an App ID in Project Settings."
      )
    ).toBeTruthy();

    screen.getByRole("button", { name: "Open Project Settings" }).click();
    expect(onConnectService).toHaveBeenCalledWith("intent:app-store-connect-project");
  });
});
