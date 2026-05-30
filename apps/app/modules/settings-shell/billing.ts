import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import { getWebEnv } from "@/lib/env";

const log = createLogger("api/billing/portal");

/**
 * GET /api/billing/portal — Redirect to Lemon Squeezy customer portal.
 */
export async function handleBillingPortal() {
  const storeId = getWebEnv("LEMONSQUEEZY_STORE_ID");
  if (!storeId) {
    log.error("LEMONSQUEEZY_STORE_ID not configured");
    return errorJson(500, "Billing not configured");
  }

  const portalUrl = `https://app.lemonsqueezy.com/my-orders`;

  return NextResponse.redirect(portalUrl);
}
