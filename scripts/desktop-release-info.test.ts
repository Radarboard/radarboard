import { describe, expect, it } from "vitest";
import { buildDesktopReleaseInfo, readVersionFromJson } from "./desktop-release-info";

describe("desktop-release-info", () => {
  it("reads the desktop package version from JSON", () => {
    expect(readVersionFromJson('{"name":"@radarboard/desktop","version":"0.1.1-beta.1"}')).toBe(
      "0.1.1-beta.1"
    );
  });

  it("reports unchanged when the base and current versions match", () => {
    expect(
      buildDesktopReleaseInfo({
        currentVersion: "0.1.1-beta.1",
        previousVersion: "0.1.1-beta.1",
        head: "abc123",
      })
    ).toEqual({
      tag: "desktop-v0.1.1-beta.1",
      version: "0.1.1-beta.1",
      previous: "0.1.1-beta.1",
      changed: false,
      head: "abc123",
    });
  });

  it("reports changed when the desktop version changed", () => {
    expect(
      buildDesktopReleaseInfo({
        currentVersion: "0.1.1-beta.1",
        previousVersion: "0.1.0",
        head: "abc123",
      }).changed
    ).toBe(true);
  });

  it("forces the current candidate for manual workflow dispatch", () => {
    expect(
      buildDesktopReleaseInfo({
        currentVersion: "0.1.1-beta.1",
        previousVersion: null,
        head: "HEAD",
        forceCurrent: true,
      })
    ).toEqual({
      tag: "desktop-v0.1.1-beta.1",
      version: "0.1.1-beta.1",
      previous: null,
      changed: true,
      head: "HEAD",
    });
  });
});
