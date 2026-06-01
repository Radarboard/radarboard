import { describe, expect, it } from "vitest";
import { deriveAllProjects } from "../derived-projects";

describe("deriveAllProjects", () => {
  it("includes user-created projects and their user-created platforms from saved settings", () => {
    const projects = deriveAllProjects({
      "@@projects": {
        _: {
          ids: ["llms-txt-hub"],
        },
      },
      "@@proj_llms-txt-hub": {
        _: {
          name: "LLMS.TXT Hub",
          color: "#5b8af5",
          description: "Index and monitor llms.txt assets",
        },
      },
      "llms-txt-hub": {
        "@@platforms": {
          ids: ["website-main"],
        },
        "@@plat_website-main": {
          name: "LLMS.txt Hub",
          type: "website",
        },
        "website-main": {
          github: {
            owner: "thedaviddias",
            repo: "llms-txt-hub",
          },
        },
      },
    });

    expect(projects).toEqual([
      {
        id: "llms-txt-hub",
        slug: "llms-txt-hub",
        name: "LLMS.TXT Hub",
        color: "#5b8af5",
        description: "Index and monitor llms.txt assets",
        platforms: [
          {
            id: "website-main",
            name: "LLMS.txt Hub",
            type: "website",
            integrations: {},
          },
        ],
      },
    ]);
  });

  it("uses the project slug as a fallback name when no custom metadata exists", () => {
    const projects = deriveAllProjects({
      "@@projects": {
        _: {
          ids: ["plain-project"],
        },
      },
    });

    expect(projects).toEqual([
      {
        id: "plain-project",
        slug: "plain-project",
        name: "plain-project",
        color: "#666666",
        description: "",
        platforms: [],
      },
    ]);
  });

  it("includes user-created projects restored from metadata keys when the id index is stale", () => {
    const projects = deriveAllProjects({
      "@@proj_goshuin": {
        _: {
          name: "Goshuin",
          color: "#5b8af5",
        },
      },
    });

    expect(projects).toEqual([
      {
        id: "goshuin",
        slug: "goshuin",
        name: "Goshuin",
        color: "#5b8af5",
        description: "",
        platforms: [],
      },
    ]);
  });
});
