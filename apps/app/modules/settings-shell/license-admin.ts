import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";
import { getWebEnv } from "@/lib/env";
import { signLicenseKey } from "@/lib/license-crypto";

const log = createLogger("api/admin/license");

/**
 * Verify the request has a valid admin bearer token.
 * Uses RADARBOARD_API_SECRET as the shared secret.
 */
function isAdminAuthorized(request: Request): boolean {
  const secret = getWebEnv("RADARBOARD_API_SECRET");
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice(7) === secret;
}

const IssueLicenseSchema = z.object({
  email: z.string().email(),
  plan: z.enum(["pro", "enterprise"]),
  durationDays: z.number().int().min(1).max(36500).default(36500),
});

/**
 * POST /api/admin/license — Issue a signed license key.
 *
 * Requires Bearer token matching RADARBOARD_API_SECRET.
 */
export async function handleIssueLicense(request: Request) {
  if (!isAdminAuthorized(request)) {
    return errorJson(401, "Unauthorized");
  }

  const privateKeyB64 = getWebEnv("RADARBOARD_LICENSE_PRIVATE_KEY");
  if (!privateKeyB64) {
    return errorJson(500, "License signing key not configured (RADARBOARD_LICENSE_PRIVATE_KEY)");
  }

  try {
    const parsed = await parseBody(request, IssueLicenseSchema);
    if (!parsed.ok) return parsed.response;

    const { email, plan, durationDays } = parsed.data;
    const now = Math.floor(Date.now() / 1000);

    const licenseKey = signLicenseKey(
      { plan, email, iat: now, exp: now + durationDays * 86400 },
      privateKeyB64
    );

    log.info("License key issued", { email, plan, durationDays });

    return NextResponse.json({
      licenseKey,
      plan,
      email,
      issuedAt: new Date(now * 1000).toISOString(),
      expiresAt: new Date((now + durationDays * 86400) * 1000).toISOString(),
    });
  } catch (err) {
    log.error("Failed to issue license key", { error: err });
    return errorJson(500, "Failed to issue license key");
  }
}
