import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { getSettingsRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { getWebEnv } from "@/lib/env";
import {
  type LemonSqueezyOrderAttributes,
  type LemonSqueezySubscriptionAttributes,
  type LemonSqueezyWebhookEvent,
  mapVariantToPlan,
  resolveSubscriptionPlan,
  verifyWebhookSignature,
} from "@/lib/lemonsqueezy";
import { signLicenseKey } from "@/lib/license-crypto";
import { sendLicenseKeyEmail } from "@/lib/license-email";

const log = createLogger("webhooks/lemonsqueezy");

/** Lifetime license duration: 100 years in days. */
const LIFETIME_DAYS = 36500;

export async function handleLemonSqueezyWebhook(request: Request) {
  const secret = getWebEnv("LEMONSQUEEZY_WEBHOOK_SECRET");
  if (!secret) {
    log.error("LEMONSQUEEZY_WEBHOOK_SECRET not configured");
    return errorJson(500, "Webhook not configured");
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    log.warn("Invalid webhook signature");
    return errorJson(401, "Invalid signature");
  }

  let event: LemonSqueezyWebhookEvent;
  try {
    event = JSON.parse(rawBody) as LemonSqueezyWebhookEvent;
  } catch {
    return errorJson(400, "Invalid JSON");
  }

  const eventName = event.meta.event_name;
  log.info("Webhook received", { event: eventName, dataId: event.data.id });

  try {
    switch (eventName) {
      case "order_created":
        await handleOrderCreated(event);
        break;
      case "subscription_created":
      case "subscription_updated":
      case "subscription_resumed":
        await handleSubscriptionActive(event);
        break;
      case "subscription_cancelled":
        await handleSubscriptionCancelled(event);
        break;
      case "subscription_expired":
        await handleSubscriptionExpired();
        break;
      default:
        log.info("Ignoring unhandled event", { event: eventName });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    log.error("Failed to process webhook", { error: err, event: eventName });
    return errorJson(500, "Processing failed");
  }
}

async function handleOrderCreated(event: LemonSqueezyWebhookEvent): Promise<void> {
  const attrs = event.data.attributes as LemonSqueezyOrderAttributes;
  const proVariantId = getWebEnv("LEMONSQUEEZY_PRO_VARIANT_ID");
  const plan = mapVariantToPlan(attrs.variant_id, proVariantId);

  if (plan === "free") {
    log.info("Order for free variant, skipping license generation", {
      variantId: attrs.variant_id,
    });
    return;
  }

  const privateKeyB64 = getWebEnv("RADARBOARD_LICENSE_PRIVATE_KEY");
  if (!privateKeyB64) {
    log.error("Cannot issue license: RADARBOARD_LICENSE_PRIVATE_KEY not configured");
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const licenseKey = signLicenseKey(
    { plan, email: attrs.user_email, iat: now, exp: now + LIFETIME_DAYS * 86400 },
    privateKeyB64
  );

  const repo = getSettingsRepo();
  await repo.setLicenseKey(licenseKey);
  await repo.setUserPlan(plan);

  log.info("License key issued for one-time purchase", {
    email: attrs.user_email,
    plan,
    orderId: event.data.id,
  });

  const expiresAt = new Date((now + LIFETIME_DAYS * 86400) * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  await sendLicenseKeyEmail({
    to: attrs.user_email,
    licenseKey,
    plan,
    expiresAt: `Lifetime (${expiresAt})`,
  });
}

async function handleSubscriptionActive(event: LemonSqueezyWebhookEvent): Promise<void> {
  const attrs = event.data.attributes as LemonSqueezySubscriptionAttributes;
  const proVariantId = getWebEnv("LEMONSQUEEZY_PRO_VARIANT_ID");
  const plan = mapVariantToPlan(attrs.variant_id, proVariantId);
  const effectivePlan = resolveSubscriptionPlan(attrs.status, plan);

  const repo = getSettingsRepo();
  await repo.setUserPlan(effectivePlan);

  log.info("Subscription activated", {
    email: attrs.user_email,
    plan: effectivePlan,
    status: attrs.status,
    variantId: attrs.variant_id,
  });
}

async function handleSubscriptionCancelled(event: LemonSqueezyWebhookEvent): Promise<void> {
  const attrs = event.data.attributes as LemonSqueezySubscriptionAttributes;
  const proVariantId = getWebEnv("LEMONSQUEEZY_PRO_VARIANT_ID");
  const plan = mapVariantToPlan(attrs.variant_id, proVariantId);

  log.info("Subscription cancelled (access continues until period ends)", {
    email: attrs.user_email,
    plan,
    endsAt: attrs.ends_at,
  });
}

async function handleSubscriptionExpired(): Promise<void> {
  const repo = getSettingsRepo();
  await repo.setUserPlan("free");

  log.info("Subscription expired, downgraded to free");
}
