import { describe, expect, it } from "vitest";

import { executeCreateGithubIssue } from "../create-github-issue";

describe("executeCreateGithubIssue", () => {
  it("reports that GitHub issue creation lives in the integration", async () => {
    const result = await executeCreateGithubIssue(
      { token: "gh_test" },
      { owner: "owner", repo: "repo", title: "Bug fix" }
    );
    expect(result.error).toContain("GitHub issue creation requires the GitHub integration");
  });
});
