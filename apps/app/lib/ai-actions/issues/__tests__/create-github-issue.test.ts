import { describe, expect, it, vi } from "vitest";

vi.mock("@radarboard/integration-github/client", () => ({
  createIssue: vi.fn().mockResolvedValue({
    number: 42,
    html_url: "https://github.com/owner/repo/issues/42",
    title: "Bug fix",
  }),
}));

import { executeCreateGithubIssue } from "../create-github-issue";

describe("executeCreateGithubIssue", () => {
  it("delegates to the integration client", async () => {
    const result = await executeCreateGithubIssue(
      { token: "gh_test" },
      { owner: "owner", repo: "repo", title: "Bug fix" }
    );
    expect(result.number).toBe(42);
    expect(result.html_url).toContain("github.com");
  });
});
