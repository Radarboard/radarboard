/**
 * License key validation for offline plan verification.
 *
 * License keys are Ed25519-signed JWTs containing:
 *   { plan: PlanTier, email: string, iat: number, exp: number }
 *
 * Verification uses the embedded public key (NEXT_PUBLIC_RADARBOARD_LICENSE_PUBLIC_KEY)
 * via Web Crypto API — works offline in Node, Edge, and browser.
 *
 * For desktop/self-hosted: users paste a license key in Settings > Features.
 * No server call needed — the public key is baked into the app bundle.
 */

import type { PlanTier } from "@radarboard/feature-sdk/types";
import { getWebEnv } from "@/lib/system/runtime/env";
import { type LicensePayload, verifyLicenseSignature } from "./license-crypto";

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { LicensePayload } from "./license-crypto";

export interface LicenseValidationResult {
  valid: boolean;
  payload?: LicensePayload;
  error?: string;
}

// ---------------------------------------------------------------------------
// Quick structural validation (synchronous, no crypto)
// ---------------------------------------------------------------------------

const VALID_PLANS: PlanTier[] = ["free", "pro", "enterprise"];

/**
 * Fast structural check — validates format, fields, and expiry.
 * Does NOT verify the cryptographic signature.
 * Use `validateLicenseKeyFull()` for complete validation.
 */
export function validateLicenseKey(key: string): LicenseValidationResult {
  try {
    const parts = key.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid license key format" };
    }

    const payloadB64 = parts[1] ?? "";
    // JWT uses base64url — convert to standard base64 for atob
    const standardB64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(standardB64)) as Partial<LicensePayload>;

    if (!decoded.plan || !decoded.email || !decoded.exp) {
      return { valid: false, error: "License key is missing required fields" };
    }

    if (!VALID_PLANS.includes(decoded.plan)) {
      return { valid: false, error: `Invalid plan: ${decoded.plan}` };
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      return { valid: false, error: "License key has expired" };
    }

    return { valid: true, payload: decoded as LicensePayload };
  } catch {
    return { valid: false, error: "Failed to decode license key" };
  }
}

// ---------------------------------------------------------------------------
// Full cryptographic validation (async)
// ---------------------------------------------------------------------------

/**
 * Fully validate a license key including Ed25519 signature verification.
 * Falls back to structural-only validation if the public key is not configured.
 */
export async function validateLicenseKeyFull(key: string): Promise<LicenseValidationResult> {
  const publicKeyB64 = getWebEnv("NEXT_PUBLIC_RADARBOARD_LICENSE_PUBLIC_KEY");

  if (!publicKeyB64) {
    // No public key configured — fall back to structural validation only
    return validateLicenseKey(key);
  }

  return verifyLicenseSignature(key, publicKeyB64);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the plan tier from a license key without full validation.
 * Returns null if the key is invalid or expired.
 */
export function getPlanFromLicenseKey(key: string | null): PlanTier | null {
  if (!key) return null;
  const result = validateLicenseKey(key);
  if (!result.valid || !result.payload) return null;
  return result.payload.plan;
}
