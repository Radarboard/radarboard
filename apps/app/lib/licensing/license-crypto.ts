/**
 * License key cryptographic operations.
 *
 * Signing uses Node.js `crypto` (server-only).
 * Verification uses Web Crypto API (works in Node, Edge, and browser).
 *
 * Key format: Ed25519 PEM, base64-encoded for env var storage.
 */

import type { PlanTier } from "@radarboard/feature-sdk/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LicensePayload {
  plan: PlanTier;
  email: string;
  iat: number;
  exp: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Base64url encode (no padding). */
function b64url(data: string | Uint8Array): string {
  const str =
    typeof data === "string"
      ? Buffer.from(data).toString("base64")
      : Buffer.from(data).toString("base64");
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Base64url decode to Uint8Array. */
function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

/** Decode base64-encoded PEM from env var. */
function decodePemFromEnv(b64: string): string {
  return Buffer.from(b64, "base64").toString("utf-8");
}

// ---------------------------------------------------------------------------
// Signing (server-only — uses Node.js crypto)
// ---------------------------------------------------------------------------

/**
 * Sign a license key JWT using Ed25519 private key.
 * Server-only — do not import this function in client code.
 */
export function signLicenseKey(payload: LicensePayload, privateKeyB64: string): string {
  // Dynamic import to keep this tree-shakeable in client bundles
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("node:crypto") as typeof import("node:crypto");

  const pem = decodePemFromEnv(privateKeyB64);
  const key = crypto.createPrivateKey(pem);

  const header = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;

  const signature = crypto.sign(null, Buffer.from(signingInput), key);
  return `${signingInput}.${b64url(signature)}`;
}

// ---------------------------------------------------------------------------
// Verification (universal — uses Web Crypto API)
// ---------------------------------------------------------------------------

/** Import Ed25519 public key for Web Crypto verification. */
async function importPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  const pem = decodePemFromEnv(publicKeyB64);
  const lines = pem.split("\n").filter((l) => !l.startsWith("-----"));
  const der = Uint8Array.from(Buffer.from(lines.join(""), "base64"));

  return crypto.subtle.importKey("spki", der, { name: "Ed25519" }, false, ["verify"]);
}

/**
 * Verify a license key JWT signature using Ed25519 public key.
 * Works in Node, Edge, and browser environments.
 */
export async function verifyLicenseSignature(
  token: string,
  publicKeyB64: string
): Promise<{ valid: boolean; payload?: LicensePayload; error?: string }> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid license key format" };
    }

    const [header, body, sig] = parts as [string, string, string];
    const signingInput = `${header}.${body}`;

    const key = await importPublicKey(publicKeyB64);
    const signatureBytes = b64urlDecode(sig);
    const dataBytes = new TextEncoder().encode(signingInput);

    const isValid = await crypto.subtle.verify(
      "Ed25519",
      key,
      signatureBytes.buffer as ArrayBuffer,
      dataBytes.buffer as ArrayBuffer
    );

    if (!isValid) {
      return { valid: false, error: "Invalid license key signature" };
    }

    const payload = JSON.parse(Buffer.from(b64urlDecode(body)).toString("utf-8")) as LicensePayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, error: "License key has expired" };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: "Failed to verify license key" };
  }
}
