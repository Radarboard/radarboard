import { afterEach, describe, expect, it, vi } from "vitest";
import { listGitHubRepos } from "./repo-browser";

function createRepo(
  overrides: Partial<{
    full_name: string;
    name: string;
    owner: { login: string };
    description: string | null;
    stargazers_count: number;
    language: string | null;
    private: boolean;
    fork: boolean;
  }> = {}
) {
  return {
    full_name: "Radarboard/radarboard",
    name: "radarboard",
    owner: { login: "Radarboard" },
    description: "Radarboard",
    stargazers_count: 1,
    language: "TypeScript",
    private: true,
    fork: false,
    ...overrides,
  };
}

describe("repo-browser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches only the authenticated user's accessible repos and filters locally", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          createRepo(),
          createRepo({
            full_name: "org/goshuin-atlas",
            name: "goshuin-atlas",
            owner: { login: "org" },
            description: "Temple tracking",
          }),
          createRepo({
            full_name: "someone-else/public-repo",
            name: "public-repo",
            owner: { login: "someone-else" },
            description: "Does not match",
          }),
        ])
      )
    );

    const repos = await listGitHubRepos({ token: "token" }, "goshuin");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/user/repos?per_page=100&sort=pushed&direction=desc&type=all&page=1",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      })
    );
    expect(repos).toEqual([
      expect.objectContaining({
        fullName: "org/goshuin-atlas",
      }),
    ]);
  });

  it("keeps private repositories in results while still excluding forks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          createRepo({
            full_name: "acme/private-repo",
            name: "private-repo",
            owner: { login: "acme" },
            private: true,
          }),
          createRepo({
            full_name: "acme/public-repo",
            name: "public-repo",
            owner: { login: "acme" },
            private: false,
          }),
          createRepo({
            full_name: "acme/forked-repo",
            name: "forked-repo",
            owner: { login: "acme" },
            fork: true,
            private: false,
          }),
        ])
      )
    );

    const repos = await listGitHubRepos({ token: "token" }, null);

    expect(repos).toEqual([
      expect.objectContaining({
        fullName: "acme/private-repo",
        isPrivate: true,
      }),
      expect.objectContaining({
        fullName: "acme/public-repo",
        isPrivate: false,
      }),
    ]);
  });

  it("requests additional pages while searching when the first page is full", async () => {
    const pageOne = Array.from({ length: 100 }, (_, index) =>
      createRepo({
        full_name: `acme/repo-${index}`,
        name: `repo-${index}`,
        owner: { login: "acme" },
        description: index === 99 ? "contains goshuin" : "other repo",
      })
    );
    const pageTwo = [
      createRepo({
        full_name: "acme/goshuin-final",
        name: "goshuin-final",
        owner: { login: "acme" },
        description: "match on page two",
      }),
    ];

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(pageOne)))
      .mockResolvedValueOnce(new Response(JSON.stringify(pageTwo)));

    const repos = await listGitHubRepos({ token: "token" }, "goshuin");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(repos.map((repo) => repo.fullName)).toEqual(["acme/repo-99", "acme/goshuin-final"]);
  });
});
