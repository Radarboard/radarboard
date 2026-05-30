import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/data/core/repository", () => ({
  getLlmRepo: () => ({
    upsertArtifact: vi.fn().mockResolvedValue(undefined),
    getArtifact: vi.fn().mockResolvedValue(null),
    listArtifacts: vi.fn().mockResolvedValue([]),
  }),
}));

import { generateReport, getReport, resetReportStore } from "../export-report";

afterEach(() => {
  resetReportStore();
});

describe("export report", () => {
  it("generates a markdown report", async () => {
    const report = await generateReport("Weekly Analysis", [
      { title: "Revenue", content: "Revenue is up 15% week-over-week." },
      { title: "Anomalies", content: "One spike detected in error rate." },
    ]);

    expect(report.id).toBeDefined();
    expect(report.markdown).toContain("# Weekly Analysis");
    expect(report.markdown).toContain("## Revenue");
    expect(report.markdown).toContain("## Anomalies");
    expect(report.markdown).toContain("Revenue is up 15%");
  });

  it("retrieves a report by id from memory cache", async () => {
    const report = await generateReport("Test", [{ title: "S1", content: "Content" }]);
    const found = await getReport(report.id);
    expect(found?.title).toBe("Test");
  });

  it("returns null for non-existent report", async () => {
    expect(await getReport("non-existent")).toBeNull();
  });
});
