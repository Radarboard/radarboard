import { describe, expect, it } from "vitest";
import { buildHdiutilArgs, resolveBundleArch } from "./build-dmg.mjs";

describe("build-dmg", () => {
  it("maps process architectures to tauri bundle architectures", () => {
    expect(resolveBundleArch("arm64")).toBe("aarch64");
    expect(resolveBundleArch("x64")).toBe("x86_64");
    expect(resolveBundleArch("aarch64")).toBe("aarch64");
  });

  it("builds an hdiutil invocation for dmg packaging", () => {
    const args = buildHdiutilArgs({
      appName: "Radarboard",
      dmgPath: "/tmp/Radarboard_0.1.0_aarch64.dmg",
      sourceDir: "/tmp/source",
    });

    expect(args).toEqual([
      "create",
      "-volname",
      "Radarboard",
      "-srcfolder",
      "/tmp/source",
      "-ov",
      "-format",
      "UDZO",
      "/tmp/Radarboard_0.1.0_aarch64.dmg",
    ]);
  });
});
