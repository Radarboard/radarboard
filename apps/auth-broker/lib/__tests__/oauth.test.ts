import { afterEach, describe, expect, it, vi } from "vitest";
import {
  brokerCredentialKey,
  getBrokerRedirectUri,
  isAllowedReturnOrigin,
  safeEqual,
  sha256Base64Url,
} from "../oauth";

describe("auth broker OAuth helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows Radarboard and HTTPS loopback return origins", () => {
    expect(isAllowedReturnOrigin("https://radarboard.app")).toBe(true);
    expect(isAllowedReturnOrigin("https://auth.radarboard.app")).toBe(true);
    expect(isAllowedReturnOrigin("https://radarboard.localhost:1355")).toBe(true);
    expect(isAllowedReturnOrigin("https://127.0.0.1:1355")).toBe(true);
  });

  it("rejects non-HTTPS and unrelated return origins", () => {
    expect(isAllowedReturnOrigin("http://radarboard.localhost:1355")).toBe(false);
    expect(isAllowedReturnOrigin("https://evil.example.com")).toBe(false);
    expect(isAllowedReturnOrigin("javascript:alert(1)")).toBe(false);
    expect(isAllowedReturnOrigin("not-a-url")).toBe(false);
  });

  it("uses stable base64url SHA-256 challenges", () => {
    expect(sha256Base64Url("verifier")).toBe("iMnq5o6zALKXGivsnlom_0F5_WYda32GHkxlV7mq7hQ");
  });

  it("stores broker credentials under a hashed token key", () => {
    const key = brokerCredentialKey("secret-broker-token");
    expect(key).toMatch(/^oauth-broker-credential::/u);
    expect(key).not.toContain("secret-broker-token");
  });

  it("compares verifier material without accepting length mismatches", () => {
    expect(safeEqual("same", "same")).toBe(true);
    expect(safeEqual("same", "different")).toBe(false);
    expect(safeEqual("same", "same-but-longer")).toBe(false);
  });

  it("builds the Google redirect URI from broker configuration", () => {
    vi.stubEnv("RADARBOARD_OAUTH_BROKER_URL", "https://custom-auth.example.com/");
    expect(getBrokerRedirectUri()).toBe("https://custom-auth.example.com/api/auth/google/callback");
  });
});
