import { API_ROUTES } from "@radarboard/types/api-routes";
import type { ProjectIntegrationsConfig } from "@radarboard/types/database";
import type { Project } from "@radarboard/types/project";
import { describe, expect, it } from "vitest";
import {
  buildRepoPickerUrl,
  collectProjectLinkedRepoSelections,
  resolveWidgetGitHubRepoSelections,
  sortGitHubRepoPickerItems,
} from "../github-repo-multi-picker-utils";

describe("github-repo-multi-picker-utils", () => {
  it("normalizes and dedupes repo selections", () => {
    expect(
      resolveWidgetGitHubRepoSelections([
        { owner: " openai ", repo: " codex " },
        { owner: "OpenAI", repo: "codex" },
        { owner: "Radarboard", repo: "radarboard" },
        { owner: "", repo: "missing" },
        "invalid",
      ])
    ).toEqual([
      { owner: "openai", repo: "codex" },
      { owner: "Radarboard", repo: "radarboard" },
    ]);
  });

  it("builds the repo picker URL from the search query", () => {
    expect(buildRepoPickerUrl("")).toBe(API_ROUTES.githubRepos);
    expect(buildRepoPickerUrl(" codex ")).toBe(`${API_ROUTES.githubRepos}?q=codex`);
  });

  it("collects github repos already linked through projects and overrides", () => {
    const projects: Project[] = [
      {
        id: "radarboard",
        name: "Radarboard",
        slug: "radarboard",
        color: "#000000",
        platforms: [
          {
            id: "radarboard-web",
            name: "Web",
            type: "web_app",
            integrations: {
              github: { owner: "Radarboard", repo: "radarboard" },
            },
          },
        ],
      },
    ];

    const overrides: ProjectIntegrationsConfig = {
      radarboard: {
        _project: {
          github: { owner: "openai", repo: "codex" },
        },
        "radarboard-web": {
          github: { owner: "OpenAI", repo: "codex" },
        },
      },
      another: {
        "another-web": {
          github: { owner: "vercel", repo: "next.js" },
        },
      },
    };

    expect(collectProjectLinkedRepoSelections(projects, overrides)).toEqual([
      { owner: "Radarboard", repo: "radarboard" },
      { owner: "openai", repo: "codex" },
      { owner: "vercel", repo: "next.js" },
    ]);
  });

  it("sorts repo picker items by stars descending", () => {
    expect(
      sortGitHubRepoPickerItems([
        {
          owner: "openai",
          repo: "codex",
          fullName: "openai/codex",
          description: null,
          stars: 1000,
          language: "TypeScript",
        },
        {
          owner: "Radarboard",
          repo: "radarboard",
          fullName: "Radarboard/radarboard",
          description: null,
          stars: 4200,
          language: "TypeScript",
        },
        {
          owner: "vercel",
          repo: "next.js",
          fullName: "vercel/next.js",
          description: null,
          stars: 4200,
          language: "TypeScript",
        },
      ]).map((repo) => repo.fullName)
    ).toEqual(["Radarboard/radarboard", "vercel/next.js", "openai/codex"]);
  });
});
