import { describe, expect, it } from "vitest";
import { buildCask, versionToMacosSymbol } from "./update-homebrew-cask";

const baseOptions = {
  repo: "Radarboard/radarboard",
  minimumSystemVersion: "12.0",
  identifier: "com.radarboard.client",
  sha256: "a".repeat(64),
};

describe("update-homebrew-cask", () => {
  it("maps supported macOS minimum versions to Homebrew symbols", () => {
    expect(versionToMacosSymbol("12.0")).toBe("monterey");
    expect(versionToMacosSymbol("15.0")).toBe("sequoia");
  });

  it("builds the stable cask from stable desktop releases", () => {
    const cask = buildCask({
      ...baseOptions,
      version: "0.2.0",
      channel: "stable",
    });

    expect(cask).toContain('cask "radarboard" do');
    expect(cask).toContain('version "0.2.0"');
    expect(cask).toContain('conflicts_with cask: "radarboard-beta"');
    expect(cask).toContain('regex(/^desktop-v(\\d+(?:\\.\\d+){2})$/i)');
  });

  it("builds a beta cask from published beta prereleases", () => {
    const cask = buildCask({
      ...baseOptions,
      version: "0.2.0-beta.1",
      channel: "beta",
    });

    expect(cask).toContain('cask "radarboard-beta" do');
    expect(cask).toContain('name "Radarboard Beta"');
    expect(cask).toContain('conflicts_with cask: "radarboard"');
    expect(cask).toContain("Radarboard-#{version}-macos-#{arch}.dmg");
    expect(cask).toContain('regex(/^desktop-v(\\d+(?:\\.\\d+){2}-beta\\.\\d+)$/i)');
  });

  it("can point downloads and livecheck at a public tap mirror", () => {
    const cask = buildCask({
      ...baseOptions,
      version: "0.2.0-beta.1",
      channel: "beta",
      downloadRepo: "Radarboard/homebrew-radarboard",
    });

    expect(cask).toContain(
      'url "https://github.com/Radarboard/homebrew-radarboard/releases/download/desktop-v#{version}/Radarboard-#{version}-macos-#{arch}.dmg"'
    );
    expect(cask).toContain('verified: "github.com/Radarboard/homebrew-radarboard/"');
    expect(cask).toContain('url "https://github.com/Radarboard/homebrew-radarboard/releases"');
  });
});
