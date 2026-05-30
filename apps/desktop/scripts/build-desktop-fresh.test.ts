import { describe, expect, it } from "vitest";
import {
  resolveFreshInstallTargets,
  timestampForBackup,
  withBackupSuffix,
} from "./build-desktop-fresh.mjs";

describe("build-desktop-fresh", () => {
  it("formats deterministic backup timestamps", () => {
    expect(timestampForBackup(new Date(2026, 3, 8, 16, 5, 7))).toBe("20260408-160507");
  });

  it("appends a backup suffix to target paths", () => {
    expect(withBackupSuffix("/Applications/Radarboard.app", "20260408-160507")).toBe(
      "/Applications/Radarboard.app.backup-20260408-160507"
    );
  });

  it("resolves the app install path and data directories", () => {
    expect(
      resolveFreshInstallTargets({
        appName: "Radarboard.app",
        installDir: "/Applications",
        homeDir: "/Users/tester",
      })
    ).toEqual({
      appInstallPath: "/Applications/Radarboard.app",
      dataPaths: [
        "/Users/tester/Library/Application Support/Radarboard",
        "/Users/tester/Library/Application Support/com.radarboard.client",
      ],
    });
  });
});
