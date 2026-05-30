/* biome-ignore-all lint/style/useNamingConvention: Lemon Squeezy API uses snake_case */
/**
 * Lemon Squeezy webhook handling and billing utilities.
 *
 * Webhook events flow:
 *   1. User purchases Pro plan on Lemon Squeezy checkout
 *   2. LS sends webhook to /api/webhooks/lemonsqueezy
 *   3. We verify the HMAC signature
 *   4. We map the event to a plan change and update the DB
 *
 * Relevant events:
 *   - subscription_created → activate pro plan
 *   - subscription_updated → handle plan changes
 *   - subscription_cancelled → keep pro until period ends
 *   - subscription_expired → downgrade to free
 *   - order_created → one-time purchase (license key)
 */

import { createHmac } from "node:crypto";
import type { PlanTier } from "@radarboard/feature-sdk/types";
import { createLogger } from "@radarboard/logger/logger";

const log = createLogger("lemonsqueezy");

// ---------------------------------------------------------------------------
// Types (subset of Lemon Squeezy webhook payload)
// ---------------------------------------------------------------------------

export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: Record<string, string>;
  };
  data: {
    id: string;
    type: string;
    attributes: LemonSqueezySubscriptionAttributes | LemonSqueezyOrderAttributes;
  };
}

export interface LemonSqueezySubscriptionAttributes {
  store_id: number;
  customer_id: number;
  variant_id: number;
  user_email: string;
  user_name: string;
  status: "on_trial" | "active" | "paused" | "past_due" | "unpaid" | "cancelled" | "expired";
  renews_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  first_subscription_item?: {
    id: number;
    price_id: number;
  };
}

export interface LemonSqueezyOrderAttributes {
  store_id: number;
  customer_id: number;
  variant_id: number;
  user_email: string;
  user_name: string;
  status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verify the webhook signature from Lemon Squeezy.
 * Uses HMAC-SHA256 with the webhook signing secret.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return digest === signature;
}

// ---------------------------------------------------------------------------
// Plan mapping
// ---------------------------------------------------------------------------

/**
 * Map a Lemon Squeezy variant ID to a plan tier.
 * Configure LEMONSQUEEZY_PRO_VARIANT_ID in your env.
 */
export function mapVariantToPlan(variantId: number, proVariantId: string | undefined): PlanTier {
  if (proVariantId && variantId === Number(proVariantId)) {
    return "pro";
  }
  // Add more variant → plan mappings here as you add enterprise, etc.
  return "free";
}

/**
 * Determine the effective plan from a subscription status.
 * Cancelled subscriptions keep pro access until the period ends.
 */
export function resolveSubscriptionPlan(
  status: LemonSqueezySubscriptionAttributes["status"],
  plan: PlanTier
): PlanTier {
  switch (status) {
    case "active":
    case "on_trial":
    case "cancelled": // cancelled = still active until period ends
    case "past_due": // grace period — still active
      return plan;
    case "paused":
    case "unpaid":
    case "expired":
      return "free";
    default:
      log.warn("Unknown subscription status", { status });
      return "free";
  }
}
