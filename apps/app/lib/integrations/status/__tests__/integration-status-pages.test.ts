import { describe, expect, it } from "vitest";
import {
  getIntegrationStatusPageMode,
  resolveIntegrationStatusPageUrl,
} from "../integration-status-pages";

describe("integration-status-pages", () => {
  it("falls back to the suggested default when there is no override", () => {
    expect(resolveIntegrationStatusPageUrl("github", {}, "https://www.githubstatus.com")).toBe(
      "https://www.githubstatus.com"
    );
    expect(getIntegrationStatusPageMode("github", {})).toBe("inherit");
  });

  it("uses a custom override when present", () => {
    expect(
      resolveIntegrationStatusPageUrl(
        "github",
        { github: "https://status.example.com" },
        "https://www.githubstatus.com"
      )
    ).toBe("https://status.example.com");
    expect(getIntegrationStatusPageMode("github", { github: "https://status.example.com" })).toBe(
      "custom"
    );
  });

  it("allows an integration default to be explicitly disabled", () => {
    expect(
      resolveIntegrationStatusPageUrl("github", { github: null }, "https://www.githubstatus.com")
    ).toBeNull();
    expect(getIntegrationStatusPageMode("github", { github: null })).toBe("disabled");
  });
});
