import { describe, expect, it } from "vitest";
import type { ChangelogEntry, ChangelogImportTarget, PackageWatch } from "../types";
import {
  formatRelativeDate,
  getFilteredEntries,
  getProjectSummaries,
  getSourceVariant,
  repositoryLabel,
  scopeTitle,
} from "./utils";

const targets: ChangelogImportTarget[] = [
  {
    projectSlug: "atlas",
    projectName: "Atlas",
    projectColor: "#f00",
    platformId: "web",
    platformName: "Web",
    githubRepo: null,
    watchCount: 1,
  },
  {
    projectSlug: "pulse",
    projectName: "Pulse",
    projectColor: "#0f0",
    platformId: "ios",
    platformName: "iOS",
    githubRepo: null,
    watchCount: 1,
  },
];

const watches: PackageWatch[] = [
  {
    id: "watch-1",
    projectSlug: "atlas",
    projectName: "Atlas",
    platformId: "web",
    platformName: "Web",
    packageName: "@radarboard/core",
    source: "manual",
    status: "active",
    includePrereleases: false,
    createdAt: "2026-03-01T00:00:00.000Z",
    lastImportedAt: null,
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "watch-2",
    projectSlug: "pulse",
    projectName: "Pulse",
    platformId: "ios",
    platformName: "iOS",
    packageName: "@radarboard/mobile",
    source: "manual",
    status: "disabled",
    includePrereleases: false,
    createdAt: "2026-03-01T00:00:00.000Z",
    lastImportedAt: null,
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
];

const entries: ChangelogEntry[] = [
  {
    id: "entry-1",
    title: "Shipped dashboard sync",
    description: "Full release notes",
    body: "Adds webhook sync support",
    version: "1.2.0",
    packageName: "@radarboard/core",
    date: "2026-03-20",
    type: "release",
    sourceType: "github_release",
    notesQuality: "full",
    releaseUrl: null,
    publishedAt: "2026-03-20T12:00:00.000Z",
    isPrerelease: false,
    watchIds: ["watch-1"],
    projectSlugs: ["atlas"],
    platformIds: ["web"],
    createdAt: "2026-03-20T12:00:00.000Z",
  },
  {
    id: "entry-2",
    title: "Beta build",
    description: "Minimal prerelease notes",
    body: null,
    version: "1.3.0-beta.1",
    packageName: "@radarboard/mobile",
    date: "2026-03-21",
    type: "release",
    sourceType: "npm_publish",
    notesQuality: "minimal",
    releaseUrl: null,
    publishedAt: "2026-03-21T12:00:00.000Z",
    isPrerelease: true,
    watchIds: ["watch-2"],
    projectSlugs: ["pulse"],
    platformIds: ["ios"],
    createdAt: "2026-03-21T12:00:00.000Z",
  },
];

describe("changelog utils", () => {
  it("maps source variants and repository labels", () => {
    expect(getSourceVariant("github_release")).toBe("cyan");
    expect(getSourceVariant("manual")).toBe("error");
    expect(repositoryLabel("git+https://github.com/openai/codex.git")).toBe("openai/codex");
    expect(repositoryLabel("https://example.com/repo")).toBeNull();
  });

  it("builds project summaries from active watches and entries", () => {
    expect(getProjectSummaries(targets, watches, entries)).toEqual([
      {
        projectSlug: "atlas",
        projectName: "Atlas",
        projectColor: "#f00",
        watchCount: 1,
        releaseCount: 1,
        latestAt: "2026-03-20T12:00:00.000Z",
      },
      {
        projectSlug: "pulse",
        projectName: "Pulse",
        projectColor: "#0f0",
        watchCount: 0,
        releaseCount: 1,
        latestAt: "2026-03-21T12:00:00.000Z",
      },
    ]);
  });

  it("filters entries by tab, scope, and search text", () => {
    const entryMeta = {
      "entry-1": { readAt: "2026-03-22T00:00:00.000Z" },
      "entry-2": { archivedAt: "2026-03-22T00:00:00.000Z" },
    };

    expect(getFilteredEntries(entries, entryMeta, "inbox", "all", "dashboard")).toEqual([
      entries[0],
    ]);
    expect(getFilteredEntries(entries, entryMeta, "archived", "prerelease", "")).toEqual([
      entries[1],
    ]);
    expect(getFilteredEntries(entries, entryMeta, "inbox", "quality:full", "")).toEqual([
      entries[0],
    ]);
    expect(scopeTitle("project:atlas", targets)).toBe("Atlas");
  });

  it("formats relative dates with a never fallback", () => {
    expect(formatRelativeDate(null)).toBe("Never");
    expect(formatRelativeDate("2026-03-20T12:00:00.000Z")).not.toBe("Never");
  });
});
