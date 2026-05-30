import { describe, expect, it } from "vitest";
import { suggestNextActions } from "../suggest-actions";

describe("suggestNextActions", () => {
  it("suggests issue creation when anomalies detected", () => {
    const suggestions = suggestNextActions({
      hasAnomalies: true,
      hasTrends: false,
      hasComparisons: false,
      integrations: ["openpanel"],
      recentToolCalls: [],
    });

    const issueAction = suggestions.find((s) => s.toolId === "create_linear_issue");
    expect(issueAction).toBeDefined();
  });

  it("suggests comparison when trends analyzed", () => {
    const suggestions = suggestNextActions({
      hasAnomalies: false,
      hasTrends: true,
      hasComparisons: false,
      integrations: ["openpanel"],
      recentToolCalls: [],
    });

    const compareAction = suggestions.find((s) => s.toolId === "compare_metrics");
    expect(compareAction).toBeDefined();
  });

  it("suggests correlations when 3+ integrations", () => {
    const suggestions = suggestNextActions({
      hasAnomalies: false,
      hasTrends: false,
      hasComparisons: false,
      integrations: ["openpanel", "revenuecat", "betterstack"],
      recentToolCalls: [],
    });

    const corrAction = suggestions.find((s) => s.toolId === "scan_correlations");
    expect(corrAction).toBeDefined();
  });

  it("skips already-called tools", () => {
    const suggestions = suggestNextActions({
      hasAnomalies: true,
      hasTrends: true,
      hasComparisons: false,
      integrations: ["openpanel", "revenuecat", "betterstack"],
      recentToolCalls: [
        "diagnose_metric",
        "compare_metrics",
        "export_report",
        "generate_daily_briefing",
        "scan_correlations",
      ],
    });

    const diagnoseAction = suggestions.find((s) => s.toolId === "diagnose_metric");
    expect(diagnoseAction).toBeUndefined();
  });

  it("returns max 5 suggestions", () => {
    const suggestions = suggestNextActions({
      hasAnomalies: true,
      hasTrends: true,
      hasComparisons: true,
      integrations: ["a", "b", "c"],
      recentToolCalls: [],
    });

    expect(suggestions.length).toBeLessThanOrEqual(5);
  });
});
