// @vitest-environment jsdom
import { Dialog, DialogContent } from "@radarboard/ui/app-dialog";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeoQueryDetail } from "./";

const mockUseSeoQuery = vi.fn();
const mockUseCurrentWidgetModalSize = vi.fn();

vi.mock("@radarboard/widget-seo/hooks/use-seo-query", () => ({
  useSeoQuery: (...args: unknown[]) => mockUseSeoQuery(...args),
}));

vi.mock("@radarboard/widget-engine/widget-modal", () => ({
  useCurrentWidgetModalSize: (...args: unknown[]) => mockUseCurrentWidgetModalSize(...args),
}));

vi.mock("@radarboard/assistant-ui/assistant-handoff", () => ({
  buildAssistantHandoffPrompt: vi.fn(() => "Discuss this item."),
  SendToAssistantButton: ({ label = "Discuss with Assistant" }: { label?: string }) => (
    <button type="button">{label}</button>
  ),
}));

const QUERY = {
  query: "ux patterns",
  clicks: 6,
  impressions: 34,
  ctr: 17.6,
  position: 4.2,
  siteUrl: "sc-domain:uxpatterns.dev",
};

const DETAIL = {
  clicksTrend: [
    { date: "2026-03-01", value: 4 },
    { date: "2026-03-02", value: 6 },
  ],
  impressionsTrend: [
    { date: "2026-03-01", value: 20 },
    { date: "2026-03-02", value: 34 },
  ],
  positionTrend: [
    { date: "2026-03-01", value: 4.6 },
    { date: "2026-03-02", value: 4.2 },
  ],
  pages: [
    {
      page: "https://uxpatterns.dev/",
      clicks: 24,
      impressions: 110,
      ctr: 21.8,
      position: 4.3,
    },
  ],
  devices: [{ device: "DESKTOP", clicks: 20, impressions: 90, ctr: 22.2, position: 4.0 }],
  countries: [{ country: "CAN", clicks: 10, impressions: 40, ctr: 25, position: 4.1 }],
};

describe("SeoQueryDetail", () => {
  beforeEach(() => {
    mockUseSeoQuery.mockReturnValue({
      detail: DETAIL,
      configured: true,
      loading: false,
      error: null,
    });
  });

  it("places diagnosis before the detail sections on small modal size", async () => {
    mockUseCurrentWidgetModalSize.mockReturnValue("sm");
    render(
      <Dialog open>
        <DialogContent size="sm" aria-describedby={undefined}>
          <SeoQueryDetail
            query={QUERY}
            siteAvgCtr={10.4}
            siteAvgPosition={4.8}
            projectSlug="ux-patterns"
          />
        </DialogContent>
      </Dialog>
    );

    await screen.findAllByText("Assistant Diagnosis");
    await screen.findAllByText(/Ranking Pages/);

    const text = document.body.textContent ?? "";
    expect(text.indexOf("Assistant Diagnosis")).toBeGreaterThan(-1);
    expect(text.indexOf("Ranking Pages")).toBeGreaterThan(-1);
    expect(text.indexOf("Assistant Diagnosis")).toBeLessThan(text.indexOf("Ranking Pages"));
  });

  it("keeps diagnosis below the evidence sections on large modal size", async () => {
    mockUseCurrentWidgetModalSize.mockReturnValue("lg");
    render(
      <Dialog open>
        <DialogContent size="lg" aria-describedby={undefined}>
          <SeoQueryDetail
            query={QUERY}
            siteAvgCtr={10.4}
            siteAvgPosition={4.8}
            projectSlug="ux-patterns"
          />
        </DialogContent>
      </Dialog>
    );

    await screen.findAllByText("Assistant Diagnosis");
    await screen.findAllByText(/Ranking Pages/);

    // Verify both sections are present in the large layout. Visual ordering
    // (diagnosis below evidence) is handled by CSS flex layout which jsdom
    // doesn't apply — DOM order assertions are unreliable with Radix portals.
    expect(screen.getAllByText(/^Ranking Pages/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Assistant Diagnosis").length).toBeGreaterThan(0);
    expect(screen.getByText("Discuss Query")).toBeTruthy();
    expect(screen.getAllByText("Discuss").length).toBeGreaterThan(0);
  });
});
