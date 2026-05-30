export type ChangelogType = "release" | "deployment" | "hotfix";

export type ChangelogWatchSource = "import" | "manual";
export type ChangelogWatchStatus = "active" | "muted" | "disabled";
export type ChangelogReleaseSource = "github_release" | "github_atom" | "npm_publish" | "manual";
export type ChangelogNotesQuality = "full" | "minimal";
export type ChangelogBodyFormat = "markdown" | "html" | "text";

export interface ChangelogGitHubRepoRef {
  owner: string;
  repo: string;
}

export interface TrackedPackage {
  packageName: string;
  npmUrl: string;
  homepageUrl: string | null;
  repositoryUrl: string | null;
  releaseSource: ChangelogReleaseSource;
  notesQuality: ChangelogNotesQuality;
  githubRepo: ChangelogGitHubRepoRef | null;
  lastStableVersion: string | null;
  lastPrereleaseVersion: string | null;
  lastPublishedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PackageWatch {
  id: string;
  projectSlug: string;
  projectName: string;
  platformId: string;
  platformName: string;
  packageName: string;
  source: ChangelogWatchSource;
  status: ChangelogWatchStatus;
  includePrereleases: boolean;
  createdAt: string;
  lastImportedAt: string | null;
  updatedAt: string;
}

export interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  body?: string | null;
  bodyFormat?: ChangelogBodyFormat;
  version: string;
  packageName: string;
  date: string;
  type: ChangelogType;
  sourceType: ChangelogReleaseSource;
  notesQuality: ChangelogNotesQuality;
  releaseUrl: string | null;
  publishedAt: string;
  isPrerelease: boolean;
  watchIds: string[];
  projectSlugs: string[];
  platformIds: string[];
  projectId?: string;
  createdAt: string;
}

export interface ChangelogSyncState {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  activeWatchCount: number;
}

export interface ChangelogImportTarget {
  projectSlug: string;
  projectName: string;
  projectColor: string;
  platformId: string;
  platformName: string;
  githubRepo: ChangelogGitHubRepoRef | null;
  watchCount: number;
}

export interface ChangelogEntryMeta {
  readAt: string | null;
  archivedAt: string | null;
}

export type ChangelogEntryMetaMap = Record<string, ChangelogEntryMeta>;

export interface ChangelogState {
  targets: ChangelogImportTarget[];
  watches: PackageWatch[];
  trackedPackages: TrackedPackage[];
  entries: ChangelogEntry[];
  entryMeta: ChangelogEntryMetaMap;
  syncState: ChangelogSyncState;
}
