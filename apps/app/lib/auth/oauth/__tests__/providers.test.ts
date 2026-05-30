import { describe, expect, it } from "vitest";
import { getOAuthProvider, listOAuthProviders } from "../providers";

describe("oauth providers", () => {
  it("lists supported oauth providers", () => {
    const providers = listOAuthProviders();
    expect(providers.map((p) => p.providerId)).toEqual(["openai"]);
  });

  it("returns openai config with static registration", () => {
    const provider = getOAuthProvider("openai");
    expect(provider?.dynamicRegistration).toBe(false);
    expect(provider?.authorizationEndpoint).toContain("auth.openai.com");
    expect(provider?.scopes).toContain("offline_access");
  });

  it("returns null for unsupported providers", () => {
    expect(getOAuthProvider("anthropic")).toBeNull();
    expect(getOAuthProvider("google")).toBeNull();
  });
});
