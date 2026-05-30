import { describe, expect, it } from "vitest";
import { generateCodeChallenge, generateCodeVerifier, generateState } from "../pkce";

describe("PKCE", () => {
  it("generates a code verifier of valid length", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    // RFC 7636: unreserved characters only
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("generates unique verifiers each time", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it("generates a valid S256 code challenge from a verifier", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    // Base64url encoded SHA-256 hash — no padding, no + or /
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge.length).toBeGreaterThan(0);
  });

  it("generates a unique state parameter", () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});
