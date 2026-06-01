import { describe, expect, it } from "vitest";
import { isAllowedBrokerReturnOrigin, sha256Base64Url } from "../broker";

describe("OAuth broker helpers", () => {
  it("allows Radarboard and loopback return origins", () => {
    expect(isAllowedBrokerReturnOrigin("https://app.radarboard.app")).toBe(true);
    expect(isAllowedBrokerReturnOrigin("https://radarboard.localhost:1355")).toBe(true);
    expect(isAllowedBrokerReturnOrigin("https://127.0.0.1:4311")).toBe(true);
  });

  it("rejects unrelated return origins", () => {
    expect(isAllowedBrokerReturnOrigin("http://127.0.0.1:4311")).toBe(false);
    expect(isAllowedBrokerReturnOrigin("https://evil.example.com")).toBe(false);
    expect(isAllowedBrokerReturnOrigin("javascript:alert(1)")).toBe(false);
  });

  it("uses stable base64url SHA-256 challenges", () => {
    expect(sha256Base64Url("verifier")).toBe("iMnq5o6zALKXGivsnlom_0F5_WYda32GHkxlV7mq7hQ");
  });
});
