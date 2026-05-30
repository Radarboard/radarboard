import { describe, expect, it } from "vitest";
import { buildSeoQueryDiagnosis } from "./";

describe("buildSeoQueryDiagnosis", () => {
  it("flags page-one queries with strong ctr as a top-3 opportunity", () => {
    const diagnosis = buildSeoQueryDiagnosis(
      {
        query: "ux patterns",
        clicks: 6,
        impressions: 34,
        ctr: 17.6,
        position: 4.2,
        siteUrl: "sc-domain:uxpatterns.dev",
      },
      {
        clicksTrend: [
          { date: "2026-03-01", value: 4 },
          { date: "2026-03-02", value: 4 },
          { date: "2026-03-03", value: 5 },
          { date: "2026-03-04", value: 5 },
          { date: "2026-03-05", value: 6 },
          { date: "2026-03-06", value: 6 },
          { date: "2026-03-07", value: 7 },
          { date: "2026-03-08", value: 7 },
        ],
        impressionsTrend: [
          { date: "2026-03-01", value: 20 },
          { date: "2026-03-02", value: 22 },
          { date: "2026-03-03", value: 24 },
          { date: "2026-03-04", value: 24 },
          { date: "2026-03-05", value: 30 },
          { date: "2026-03-06", value: 31 },
          { date: "2026-03-07", value: 33 },
          { date: "2026-03-08", value: 34 },
        ],
        positionTrend: [
          { date: "2026-03-01", value: 4.8 },
          { date: "2026-03-02", value: 4.7 },
          { date: "2026-03-03", value: 4.6 },
          { date: "2026-03-04", value: 4.4 },
          { date: "2026-03-05", value: 4.3 },
          { date: "2026-03-06", value: 4.2 },
          { date: "2026-03-07", value: 4.2 },
          { date: "2026-03-08", value: 4.1 },
        ],
        pages: [
          {
            page: "https://uxpatterns.dev/",
            clicks: 24,
            impressions: 110,
            ctr: 21.8,
            position: 4.3,
          },
          {
            page: "https://uxpatterns.dev/blog",
            clicks: 2,
            impressions: 18,
            ctr: 11.1,
            position: 6.4,
          },
        ],
        devices: [
          { device: "DESKTOP", clicks: 20, impressions: 90, ctr: 22.2, position: 4.0 },
          { device: "MOBILE", clicks: 2, impressions: 20, ctr: 10, position: 5.1 },
        ],
        countries: [
          { country: "CAN", clicks: 10, impressions: 40, ctr: 25, position: 4.1 },
          { country: "USA", clicks: 8, impressions: 35, ctr: 22.8, position: 4.4 },
        ],
      },
      10.4,
      4.8
    );

    expect(diagnosis.headline).toContain("top-3 upside");
    expect(diagnosis.opportunity.label).toBe("Top-3 opportunity");
    expect(diagnosis.recommendations[0]?.title).toContain("top 3");
    expect(diagnosis.confidence).toBe("high");
  });

  it("recommends snippet work when ctr lags despite strong visibility", () => {
    const diagnosis = buildSeoQueryDiagnosis(
      {
        query: "best dashboard",
        clicks: 8,
        impressions: 220,
        ctr: 3.6,
        position: 3.8,
        siteUrl: "https://example.com",
      },
      {
        clicksTrend: [
          { date: "2026-03-01", value: 8 },
          { date: "2026-03-02", value: 8 },
          { date: "2026-03-03", value: 7 },
          { date: "2026-03-04", value: 7 },
        ],
        impressionsTrend: [
          { date: "2026-03-01", value: 180 },
          { date: "2026-03-02", value: 190 },
          { date: "2026-03-03", value: 210 },
          { date: "2026-03-04", value: 220 },
        ],
        positionTrend: [
          { date: "2026-03-01", value: 3.7 },
          { date: "2026-03-02", value: 3.9 },
          { date: "2026-03-03", value: 3.8 },
          { date: "2026-03-04", value: 3.8 },
        ],
        pages: [
          {
            page: "https://example.com/best-dashboard",
            clicks: 8,
            impressions: 220,
            ctr: 3.6,
            position: 3.8,
          },
        ],
        devices: [{ device: "MOBILE", clicks: 5, impressions: 120, ctr: 4.2, position: 3.7 }],
        countries: [{ country: "USA", clicks: 4, impressions: 100, ctr: 4, position: 3.8 }],
      },
      8.4,
      5.2
    );

    expect(diagnosis.opportunity.label).toBe("CTR opportunity");
    expect(diagnosis.summary).toContain("CTR is underperforming");
    expect(diagnosis.recommendations.some((item) => item.title.includes("SERP snippet"))).toBe(
      true
    );
  });
});
