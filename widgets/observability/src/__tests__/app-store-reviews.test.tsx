// @vitest-environment jsdom
import type { AppStoreOverview } from "@radarboard/types/app-store-connect";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { AppStoreReviews } from "../components/app-store-reviews";

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

describe("AppStoreReviews", () => {
  it("renders review rows through the shared two-line row", async () => {
    render(createElement(AppStoreReviews, { data: FIXTURE }));

    expect(await screen.findByText("Excellent shrine tracker")).toBeTruthy();
    expect(screen.getByText("david · CA")).toBeTruthy();
    expect(screen.getByText("Pressure")).toBeTruthy();
    expect(screen.getByText("Summary")).toBeTruthy();
    expect(
      screen.getByText(
        "Users praise the design, but some mention onboarding friction in the latest release."
      )
    ).toBeTruthy();
    expect(screen.getByText("1 low · 12 positive")).toBeTruthy();
  });
});
