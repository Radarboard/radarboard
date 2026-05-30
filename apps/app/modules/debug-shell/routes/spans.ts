import { getSpanStats, getSpans } from "@radarboard/observability/collector";
import { NextResponse } from "next/server";

export async function handleListDebugSpans() {
  const spans = getSpans();
  const stats = getSpanStats();

  return NextResponse.json({
    spans: spans.slice(-100),
    stats,
  });
}
