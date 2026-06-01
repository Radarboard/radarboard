import { describe, expect, it } from "vitest";
import { getServiceFaviconUrl } from "../service-favicons";

describe("service favicons", () => {
  it.each([
    ["https://stripe.com", "stripe.com"],
    ["https://umami.is/docs/api", "umami.is"],
    ["https://developer.raindrop.io/v1/authentication/token", "developer.raindrop.io"],
  ])("returns the Google favicon URL for %s", (serviceUrl, domain) => {
    expect(getServiceFaviconUrl(serviceUrl, 32)).toBe(
      `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    );
  });

  it("accepts bare domains", () => {
    expect(getServiceFaviconUrl("github.com", 32)).toBe(
      "https://www.google.com/s2/favicons?domain=github.com&sz=32"
    );
  });

  it("returns an empty string when no service-owned URL is available", () => {
    expect(getServiceFaviconUrl(null, 32)).toBe("");
  });
});
