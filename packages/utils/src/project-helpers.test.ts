import type { Project } from "@radarboard/types/project";
import { describe, expect, it } from "vitest";
import {
  filterByProject,
  hasIntegration,
  resolveGitHubLogin,
  resolveOcSlug,
  resolveProjectName,
  resolveWithFallback,
} from "./project-helpers";

const projects: Project[] = [
  {
    id: "1",
    name: "Radarboard",
    slug: "radarboard",
    color: "#111111",
    platforms: [
      {
        id: "platform-1",
        name: "radarboard.app",
        type: "web_app",
        integrations: {
          github: { owner: "thedaviddias" },
          openCollective: { slug: "radarboard" },
        },
      },
    ],
  },
  {
    id: "2",
    name: "Docs",
    slug: "docs",
    color: "#222222",
    platforms: [
      {
        id: "platform-2",
        name: "docs.radarboard.app",
        type: "website",
        integrations: {},
      },
    ],
  },
];

describe("project helpers", () => {
  it("resolves integrations and project metadata from the active project", () => {
    expect(hasIntegration(projects, "radarboard", "github")).toBe(true);
    expect(hasIntegration(projects, "docs", "github")).toBe(false);
    expect(resolveOcSlug(projects, "radarboard")).toBe("radarboard");
    expect(resolveGitHubLogin(projects, "radarboard")).toBe("thedaviddias");
    expect(resolveProjectName(projects, "docs")).toBe("Docs");
  });

  it("falls back for all-project mode and utility filters", () => {
    expect(hasIntegration(projects, null, "anything")).toBe(true);
    expect(resolveOcSlug(projects, null)).toBe("front-end-checklist");
    expect(resolveGitHubLogin(projects, null)).toBe("thedaviddias");
    expect(resolveWithFallback(["configured"], true, ["fallback"])).toEqual(["configured"]);
    expect(resolveWithFallback([], true, ["fallback"])).toEqual(["fallback"]);
    expect(
      filterByProject(
        [
          { id: "a", projectName: "Radarboard" },
          { id: "b", projectName: "Docs" },
        ],
        "Docs"
      )
    ).toEqual([{ id: "b", projectName: "Docs" }]);
  });
});
