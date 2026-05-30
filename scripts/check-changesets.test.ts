import { describe, expect, it } from "vitest";

import { parseChangesetFile, validateParsedChangesets } from "./check-changesets";

describe("parseChangesetFile", () => {
  it("parses a valid changeset file", () => {
    const parsed = parseChangesetFile(
      ".changeset/example.md",
      [
        "---",
        '"@radarboard/ui": patch',
        '"@radarboard/widget-engine": minor',
        "---",
        "",
        "Summarize the change.",
      ].join("\n")
    );

    expect(parsed.releases).toEqual([
      { packageName: "@radarboard/ui", releaseType: "patch" },
      { packageName: "@radarboard/widget-engine", releaseType: "minor" },
    ]);
  });

  it("rejects invalid frontmatter", () => {
    expect(() => parseChangesetFile(".changeset/example.md", '"@radarboard/ui": patch')).toThrow(
      'Changesets must start with frontmatter delimited by "---".'
    );
  });

  it("rejects an empty summary", () => {
    expect(() =>
      parseChangesetFile(
        ".changeset/example.md",
        ["---", '"@radarboard/ui": patch', "---", ""].join("\n")
      )
    ).toThrow("Changeset summary must not be empty.");
  });
});

describe("validateParsedChangesets", () => {
  it("rejects mixed ignored and versioned packages", () => {
    const parsed = parseChangesetFile(
      ".changeset/workspace-vitest-rollout.md",
      [
        "---",
        '"@radarboard/feature-onboarding": patch',
        '"@radarboard/ui": patch',
        "---",
        "",
        "Roll out shared Vitest configuration.",
      ].join("\n")
    );

    expect(() =>
      validateParsedChangesets([parsed], new Set(["@radarboard/feature-onboarding"]))
    ).toThrow("Found mixed changeset workspace-vitest-rollout");
  });
});
