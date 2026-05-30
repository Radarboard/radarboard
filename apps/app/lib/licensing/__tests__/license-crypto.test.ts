import { generateKeyPairSync } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { LicensePayload } from "../license-crypto";
import { signLicenseKey, verifyLicenseSignature } from "../license-crypto";

// ---------------------------------------------------------------------------
// Generate a real Ed25519 keypair for testing
// ---------------------------------------------------------------------------

let privateKeyB64: string;
let publicKeyB64: string;

beforeAll(() => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const publicPem = publicKey.export({ type: "spki", format: "pem" }) as string;

  privateKeyB64 = Buffer.from(privatePem).toString("base64");
  publicKeyB64 = Buffer.from(publicPem).toString("base64");
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validPayload(): LicensePayload {
  return {
    plan: "pro",
    email: "test@example.com",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // +1 day
  };
}

function expiredPayload(): LicensePayload {
  return {
    plan: "pro",
    email: "test@example.com",
    iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  };
}

// ---------------------------------------------------------------------------
// Sign + Verify roundtrip
// ---------------------------------------------------------------------------

describe("signLicenseKey + verifyLicenseSignature roundtrip", () => {
  it("sign then verify produces valid result with correct payload", async () => {
    const payload = validPayload();
    const token = signLicenseKey(payload, privateKeyB64);

    // Token should have 3 parts (header.payload.signature)
    expect(token.split(".")).toHaveLength(3);

    const result = await verifyLicenseSignature(token, publicKeyB64);
    expect(result.valid).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.payload?.plan).toBe("pro");
    expect(result.payload?.email).toBe("test@example.com");
    expect(result.payload?.iat).toBe(payload.iat);
    expect(result.payload?.exp).toBe(payload.exp);
  });

  it("verifies enterprise plan tokens", async () => {
    const payload: LicensePayload = {
      ...validPayload(),
      plan: "enterprise",
    };
    const token = signLicenseKey(payload, privateKeyB64);
    const result = await verifyLicenseSignature(token, publicKeyB64);
    expect(result.valid).toBe(true);
    expect(result.payload?.plan).toBe("enterprise");
  });

  it("verifies free plan tokens", async () => {
    const payload: LicensePayload = {
      ...validPayload(),
      plan: "free",
    };
    const token = signLicenseKey(payload, privateKeyB64);
    const result = await verifyLicenseSignature(token, publicKeyB64);
    expect(result.valid).toBe(true);
    expect(result.payload?.plan).toBe("free");
  });
});

// ---------------------------------------------------------------------------
// Signature tampering
// ---------------------------------------------------------------------------

describe("signature tampering", () => {
  it("fails when signature is tampered with", async () => {
    const token = signLicenseKey(validPayload(), privateKeyB64);
    const parts = token.split(".");

    // Flip some characters in the signature
    const tamperedSig = `${parts[2]?.slice(0, -4)}XXXX`;
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;

    const result = await verifyLicenseSignature(tamperedToken, publicKeyB64);
    expect(result.valid).toBe(false);
  });

  it("fails when signature is completely replaced", async () => {
    const token = signLicenseKey(validPayload(), privateKeyB64);
    const parts = token.split(".");

    // Replace signature entirely
    const fakeSignature = Buffer.from("completely-fake-signature").toString("base64url");
    const tamperedToken = `${parts[0]}.${parts[1]}.${fakeSignature}`;

    const result = await verifyLicenseSignature(tamperedToken, publicKeyB64);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Payload tampering
// ---------------------------------------------------------------------------

describe("payload tampering", () => {
  it("fails when payload is tampered with", async () => {
    const token = signLicenseKey(validPayload(), privateKeyB64);
    const parts = token.split(".");

    // Create a modified payload (change plan from pro to enterprise)
    const modifiedPayload = { ...validPayload(), plan: "enterprise" as const };
    const modifiedB64 = Buffer.from(JSON.stringify(modifiedPayload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Use original header and signature but tampered payload
    const tamperedToken = `${parts[0]}.${modifiedB64}.${parts[2]}`;

    const result = await verifyLicenseSignature(tamperedToken, publicKeyB64);
    expect(result.valid).toBe(false);
  });

  it("fails when email is changed in payload", async () => {
    const token = signLicenseKey(validPayload(), privateKeyB64);
    const parts = token.split(".");

    const modifiedPayload = { ...validPayload(), email: "hacker@evil.com" };
    const modifiedB64 = Buffer.from(JSON.stringify(modifiedPayload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const tamperedToken = `${parts[0]}.${modifiedB64}.${parts[2]}`;

    const result = await verifyLicenseSignature(tamperedToken, publicKeyB64);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Expired tokens
// ---------------------------------------------------------------------------

describe("expired tokens", () => {
  it("fails for expired token even with valid signature", async () => {
    const payload = expiredPayload();
    const token = signLicenseKey(payload, privateKeyB64);

    const result = await verifyLicenseSignature(token, publicKeyB64);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("expired");
  });
});

// ---------------------------------------------------------------------------
// Invalid format
// ---------------------------------------------------------------------------

describe("invalid format", () => {
  it("fails for token without 3 parts", async () => {
    const result = await verifyLicenseSignature("not.valid", publicKeyB64);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid license key format");
  });

  it("fails for empty string", async () => {
    const result = await verifyLicenseSignature("", publicKeyB64);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Wrong key
// ---------------------------------------------------------------------------

describe("wrong public key", () => {
  it("fails when verified with a different keypair", async () => {
    const token = signLicenseKey(validPayload(), privateKeyB64);

    // Generate a different keypair
    const { publicKey: otherPub } = generateKeyPairSync("ed25519");
    const otherPubPem = otherPub.export({ type: "spki", format: "pem" }) as string;
    const otherPubB64 = Buffer.from(otherPubPem).toString("base64");

    const result = await verifyLicenseSignature(token, otherPubB64);
    expect(result.valid).toBe(false);
  });
});
