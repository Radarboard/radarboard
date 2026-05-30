import { describe, expect, it } from "vitest";
import {
  computeNextBetaVersion,
  computeStableVersion,
  formatDesktopVersion,
  parseDesktopVersion,
  validateVersion,
} from "./prepare-desktop-release";

describe("prepare-desktop-release", () => {
  it("creates the first beta candidate from the current stable version", () => {
    expect(computeNextBetaVersion("0.1.0")).toBe("0.1.1-beta.1");
  });

  it("increments an existing beta candidate", () => {
    expect(computeNextBetaVersion("0.1.1-beta.1")).toBe("0.1.1-beta.2");
  });

  it("promotes the current beta base to stable", () => {
    expect(computeStableVersion("0.1.1-beta.2")).toBe("0.1.1");
  });

  it("rejects stable promotion when the current version is not beta", () => {
    expect(() => computeStableVersion("0.1.1")).toThrow(
      "Stable desktop release promotion requires the current version to be beta."
    );
  });

  it("parses and formats supported desktop release versions", () => {
    expect(formatDesktopVersion(parseDesktopVersion("1.2.3-beta.4"))).toBe("1.2.3-beta.4");
    expect(formatDesktopVersion(parseDesktopVersion("1.2.3"))).toBe("1.2.3");
  });

  it("validates channel-specific version formats", () => {
    expect(() => validateVersion({ channel: "beta", version: "0.1.1-beta.1" })).not.toThrow();
    expect(() => validateVersion({ channel: "stable", version: "0.1.1-beta.1" })).toThrow(
      "does not match stable channel format"
    );
  });
});
