import { NextResponse } from "next/server";
import { getReport } from "@/lib/ai-actions/export-report";
import { errorJson } from "@/lib/api";

export async function handleGetReportDetail(id: string) {
  const report = await getReport(id);

  if (!report) {
    return errorJson(404, "Report not found or expired");
  }

  return new NextResponse(report.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.title.replace(/[^a-zA-Z0-9-_ ]/g, "")}.md"`,
    },
  });
}
