import { beforeEach, describe, expect, it, vi } from "vitest";

const getReportMock = vi.fn();

vi.mock("@/lib/ai-actions/export-report", () => ({
  getReport: (...args: unknown[]) => getReportMock(...args),
}));

import { handleGetReportDetail as GET } from "@/modules/debug-shell/routes/report-detail";

beforeEach(() => {
  getReportMock.mockReset();
});

function callGET(id: string) {
  return GET(id);
}

describe("GET /api/dev/reports/[id]", () => {
  it("returns markdown report as attachment", async () => {
    getReportMock.mockResolvedValue({
      title: "Weekly Report",
      markdown: "# Weekly Report\n\nAll good.",
    });

    const res = await callGET("rpt-1");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("Weekly Report");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");

    const text = await res.text();
    expect(text).toContain("# Weekly Report");
  });

  it("returns 404 when report not found", async () => {
    getReportMock.mockResolvedValue(null);

    const res = await callGET("nonexistent");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found|expired/i);
  });

  it("sanitizes title in Content-Disposition header", async () => {
    getReportMock.mockResolvedValue({
      title: 'Report <script>alert("xss")</script>',
      markdown: "# Safe content",
    });

    const res = await callGET("rpt-2");
    const disposition = res.headers.get("Content-Disposition") ?? "";

    expect(disposition).not.toContain("<");
    expect(disposition).not.toContain(">");
    expect(disposition).not.toContain('"xss"');
  });

  it("passes the id to getReport", async () => {
    getReportMock.mockResolvedValue(null);

    await callGET("abc-123");

    expect(getReportMock).toHaveBeenCalledWith("abc-123");
  });
});
