import { describe, expect, it } from "vitest";
import { buildIntegrationSettingsRedirectUrl } from "../provider-callback";

describe("buildIntegrationSettingsRedirectUrl", () => {
  it("builds the success redirect back into the integration modal", () => {
    const redirectUrl = buildIntegrationSettingsRedirectUrl({
      origin: "http://127.0.0.1:57588",
      provider: "github",
      status: "success",
      credKey: "github",
    });

    expect(redirectUrl).toBe(
      "http://127.0.0.1:57588/?settings=integrations&integrationTab=access&oauth=success&provider=github&service=github"
    );
  });

  it("builds the error redirect with the same deep link and encoded error", () => {
    const redirectUrl = buildIntegrationSettingsRedirectUrl({
      origin: "http://127.0.0.1:57588",
      provider: "github",
      status: "error",
      credKey: "github",
      error: "Token exchange failed: invalid_grant",
    });

    expect(redirectUrl).toBe(
      "http://127.0.0.1:57588/?settings=integrations&integrationTab=access&oauth=error&provider=github&service=github&error=Token+exchange+failed%3A+invalid_grant"
    );
    expect(redirectUrl).not.toContain("??");
  });
});
