// @vitest-environment jsdom
import type { SentryOverview } from "@radarboard/types/sentry";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { SentryIssues } from "../components/sentry-issues";

const FIXTURE: SentryOverview = {
  unresolvedCount: 3,
  errorTrend: [
    { timestamp: new Date(Date.now() - 3_600_000).toISOString(), value: 2 },
    { timestamp: new Date(Date.now() - 1_800_000).toISOString(), value: 4 },
  ],
  issues: [
    {
      id: "issue_1",
      shortId: "AUTH-1",
      title: "Unhandled exception in auth callback",
      culprit: "app/api/auth/oauth/route.ts",
      level: "error",
      count: 48,
      userCount: 12,
      firstSeen: new Date(Date.now() - 86_400_000).toISOString(),
      lastSeen: new Date(Date.now() - 7_200_000).toISOString(),
      projectName: "Goshuin Atlas",
      projectSlug: "goshuin-atlas",
      projectColor: "#ff4f6d",
      permalink: "https://sentry.io/issues/issue_1",
      isUnhandled: true,
    },
  ],
};

describe("SentryIssues", () => {
  it("renders issue rows through the shared action row", async () => {
    render(createElement(SentryIssues, { data: FIXTURE }));

    const row = await screen.findByRole("link", {
      name: /Unhandled exception in auth callback/i,
    });

    expect(row.getAttribute("href")).toBe("https://sentry.io/issues/issue_1");
    expect(screen.getByTitle("error")).toBeTruthy();
    expect(screen.getByText("goshuin-atlas")).toBeTruthy();
    expect(screen.getByText("app/api/auth/oauth/route.ts")).toBeTruthy();
    expect(screen.getByText("48x")).toBeTruthy();
    expect(screen.getByText("2h")).toBeTruthy();
  });
});
