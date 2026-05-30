import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettingsRepo } from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";
import { getPlanFromLicenseKey, validateLicenseKeyFull } from "@/lib/license";

const log = createLogger("api/license");

/**
 * GET /api/license — Get current license status.
 */
export async function handleGetLicense() {
  try {
    const repo = getSettingsRepo();
    const key = await repo.getLicenseKey();
    if (!key) {
      return NextResponse.json({ active: false, plan: null });
    }

    const result = await validateLicenseKeyFull(key);
    return NextResponse.json({
      active: result.valid,
      plan: result.payload?.plan ?? null,
      email: result.payload?.email ?? null,
      expiresAt: result.payload?.exp ?? null,
      error: result.error ?? null,
    });
  } catch (err) {
    log.error("Failed to get license status", { error: err });
    return errorJson(500, "Failed to get license status");
  }
}

const LicensePostSchema = z.object({
  licenseKey: z.string().min(1, "License key is required"),
});

/**
 * POST /api/license — Activate a license key.
 */
export async function handleActivateLicense(request: Request) {
  try {
    const parsed = await parseBody(request, LicensePostSchema);
    if (!parsed.ok) return parsed.response;

    const { licenseKey } = parsed.data;
    const result = await validateLicenseKeyFull(licenseKey);

    if (!result.valid) {
      return errorJson(400, result.error ?? "Invalid license key");
    }

    const repo = getSettingsRepo();
    await repo.setLicenseKey(licenseKey);

    const plan = getPlanFromLicenseKey(licenseKey);
    if (plan) {
      await repo.setUserPlan(plan);
    }

    log.info("License key activated", { plan, email: result.payload?.email });

    return NextResponse.json({
      success: true,
      plan: result.payload?.plan,
      email: result.payload?.email,
      expiresAt: result.payload?.exp,
    });
  } catch (err) {
    log.error("Failed to activate license", { error: err });
    return errorJson(500, "Failed to activate license");
  }
}

/**
 * DELETE /api/license — Remove the license key.
 */
export async function handleRemoveLicense() {
  try {
    const repo = getSettingsRepo();
    await repo.setLicenseKey("");
    await repo.setUserPlan("free");

    log.info("License key removed");
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("Failed to remove license", { error: err });
    return errorJson(500, "Failed to remove license");
  }
}
