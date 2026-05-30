import { describe, expect, it } from "vitest";
import { finalizePackagePatternDraft, parsePackagePatterns, resolvePackagePatternDraft } from "../";

describe("package-patterns", () => {
  it("keeps the current draft while the textarea is being edited", () => {
    expect(resolvePackagePatternDraft(["skill-check"], "skill-check\n", true)).toBe(
      "skill-check\n"
    );
  });

  it("normalizes package lists when editing finishes", () => {
    expect(finalizePackagePatternDraft("skill-check\n")).toEqual({
      draft: "skill-check",
      patterns: ["skill-check"],
    });
  });

  it("parses newline and comma separated values into a deduped list", () => {
    expect(parsePackagePatterns("skill-check\nradarboard, skill-check")).toEqual([
      "skill-check",
      "radarboard",
    ]);
  });
});
