import { describe, expect, it } from "vitest";
import { getChangelogState, importChangelogDependencies, syncChangelog } from "../changelog-server";

describe("changelog-server", () => {
  it("returns unavailable state when the changelog plugin is not installed", async () => {
    const state = await getChangelogState();

    expect(state.syncState.status).toBe("idle");
    expect(state.entries).toEqual([]);
  });

  it("keeps sync and dependency import as safe no-ops", async () => {
    await expect(syncChangelog()).resolves.toMatchObject({ entries: [] });
    await expect(importChangelogDependencies()).resolves.toMatchObject({ importTargets: [] });
  });
});
