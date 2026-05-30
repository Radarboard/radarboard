import { describe, expect, it } from "vitest";
import { getProviderAuthMethods } from "../provider-auth";

describe("provider auth methods", () => {
  it("returns oauth + api for openai", () => {
    const methods = getProviderAuthMethods("openai");
    expect(methods.map((m) => m.type)).toEqual(["oauth", "api"]);
  });

  it("returns api only for anthropic", () => {
    const methods = getProviderAuthMethods("anthropic");
    expect(methods.map((m) => m.type)).toEqual(["api"]);
  });
});
