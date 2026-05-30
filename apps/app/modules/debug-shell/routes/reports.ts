import { NextResponse } from "next/server";
import { listReports } from "@/lib/ai-actions/export-report";

export async function handleListDebugReports() {
  return NextResponse.json({ reports: await listReports() });
}
