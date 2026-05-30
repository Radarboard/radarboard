import { describe, expect, it } from "vitest";
import {
  analyzeBriefingMetric,
  determineOverallStatus,
  formatBriefingMarkdown,
} from "../morning-briefing";

describe("analyzeBriefingMetric", () => {
  it("produces a section with trend and anomalies", () => {
    const section = analyzeBriefingMetric(
      "openpanel",
      "analytics",
      [100, 110, 120, 130, 140],
      [80, 85, 90, 95, 100]
    );

    expect(section.integration).toBe("openpanel");
    expect(section.trend).toBe("up");
    expect(section.changePct).toBeGreaterThan(0);
  });

  it("detects anomalies in metric", () => {
    const section = analyzeBriefingMetric(
      "betterstack",
      "health",
      [99, 99, 99, 99, 99, 99, 99, 20], // 20 is anomalous
      [99, 99, 99, 99, 99, 99, 99, 99]
    );

    expect(section.anomalies).toBeGreaterThan(0);
  });
});

describe("determineOverallStatus", () => {
  it("returns healthy when no issues", () => {
    const status = determineOverallStatus([
      { integration: "a", action: "b", summary: "", anomalies: 0, trend: "up", changePct: 5 },
    ]);
    expect(status).toBe("healthy");
  });

  it("returns attention on single anomaly", () => {
    const status = determineOverallStatus([
      { integration: "a", action: "b", summary: "", anomalies: 1, trend: "flat", changePct: 0 },
    ]);
    expect(status).toBe("attention");
  });

  it("returns critical on multiple anomalies", () => {
    const status = determineOverallStatus([
      { integration: "a", action: "b", summary: "", anomalies: 2, trend: "down", changePct: -25 },
      { integration: "c", action: "d", summary: "", anomalies: 2, trend: "down", changePct: -30 },
    ]);
    expect(status).toBe("critical");
  });
});

describe("formatBriefingMarkdown", () => {
  it("produces markdown with sections", () => {
    const md = formatBriefingMarkdown([
      { integration: "openpanel", action: "analytics", summary: "+15%", anomalies: 0, trend: "up", changePct: 15 },
      { integration: "revenuecat", action: "revenue", summary: "-5%", anomalies: 1, trend: "down", changePct: -5 },
    ]);

    expect(md).toContain("# Morning Briefing");
    expect(md).toContain("openpanel/analytics");
    expect(md).toContain("revenuecat/revenue");
  });
});
