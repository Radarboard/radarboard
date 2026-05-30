import { getRecentReleases, getRepository } from "@radarboard/integration-github/client";
import type { GitHubConfig } from "@radarboard/integration-github/types";
import {
  CHANGELOG_DB_KEYS,
  CHANGELOG_PLUGIN_ID,
  CHANGELOG_SYNC_INTERVAL_MS,
} from "@radarboard/plugin-changelog/model";
import type {
  ChangelogBodyFormat,
  ChangelogEntry,
  ChangelogEntryMetaMap,
  ChangelogImportTarget,
  ChangelogNotesQuality,
  ChangelogReleaseSource,
  ChangelogState,
  ChangelogSyncState,
  ChangelogWatchStatus,
  PackageWatch,
  TrackedPackage,
} from "@radarboard/plugin-changelog/types";
import type { Platform, Project } from "@radarboard/types/project";
import { PROJECTS } from "@/config/projects";
import { getCredentialRepo, getPluginRepo, getSettingsRepo } from "@/data/core/repository";

const USER_PROJECTS_KEY = "@@projects";
const USER_PROJECT_META_PREFIX = "@@proj_";
const USER_PLATFORM_IDS_KEY = "@@platforms";
const USER_PLATFORM_META_PREFIX = "@@plat_";

type ProjectIntegrationsMap = Record<string, Record<string, Record<string, unknown>>>;

interface NpmRegistryResponse {
  name: string;
  homepage?: string;
  readme?: string;
  repository?: string | { url?: string; directory?: string };
  bugs?: string | { url?: string };
  time?: Record<string, string>;
  versions?: Record<string, Record<string, unknown>>;
  "dist-tags"?: Record<string, string>;
}

interface GitHubTreeResponse {
  tree?: Array<{ path?: string; type?: string }>;
}

interface GitHubContentResponse {
  content?: string;
  encoding?: string;
}

interface ParsedPackageManifest {
  name: string | null;
  dependencies: Record<string, string>;
  workspacePatterns: string[];
}

interface ResolvedPackageSnapshot {
  tracked: TrackedPackage;
  entries: ChangelogEntry[];
}

interface SyncOptions {
  force?: boolean;
}

function now(): string {
  return new Date().toISOString();
}

function today(value: string): string {
  return value.split("T")[0] ?? value;
}

function stableSort<T>(items: T[], getter: (item: T) => string): T[] {
  return [...items].sort((left, right) => getter(left).localeCompare(getter(right)));
}

function slugifyPackageName(packageName: string): string {
  return packageName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

async function getStoredValue<T>(key: string, fallback: T): Promise<T> {
  const repo = getPluginRepo();
  const value = await repo.get(CHANGELOG_PLUGIN_ID, key);
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function setStoredValue<T>(key: string, value: T): Promise<void> {
  const repo = getPluginRepo();
  await repo.set(CHANGELOG_PLUGIN_ID, key, JSON.stringify(value));
}

async function loadWatches(): Promise<PackageWatch[]> {
  return getStoredValue<PackageWatch[]>(CHANGELOG_DB_KEYS.watches, []);
}

async function saveWatches(watches: PackageWatch[]): Promise<void> {
  await setStoredValue(
    CHANGELOG_DB_KEYS.watches,
    stableSort(watches, (watch) => watch.id)
  );
}

async function loadTrackedPackages(): Promise<TrackedPackage[]> {
  return getStoredValue<TrackedPackage[]>(CHANGELOG_DB_KEYS.trackedPackages, []);
}

async function saveTrackedPackages(trackedPackages: TrackedPackage[]): Promise<void> {
  await setStoredValue(
    CHANGELOG_DB_KEYS.trackedPackages,
    stableSort(trackedPackages, (item) => item.packageName.toLowerCase())
  );
}

async function loadEntries(): Promise<ChangelogEntry[]> {
  return getStoredValue<ChangelogEntry[]>(CHANGELOG_DB_KEYS.entries, []);
}

async function saveEntries(entries: ChangelogEntry[]): Promise<void> {
  await setStoredValue(
    CHANGELOG_DB_KEYS.entries,
    [...entries].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
  );
}

async function loadSyncState(): Promise<ChangelogSyncState> {
  return getStoredValue<ChangelogSyncState>(CHANGELOG_DB_KEYS.syncState, {
    lastRunAt: null,
    lastSuccessAt: null,
    activeWatchCount: 0,
  });
}

async function saveSyncState(syncState: ChangelogSyncState): Promise<void> {
  await setStoredValue(CHANGELOG_DB_KEYS.syncState, syncState);
}

async function loadEntryMeta(): Promise<ChangelogEntryMetaMap> {
  return getStoredValue<ChangelogEntryMetaMap>(CHANGELOG_DB_KEYS.entryMeta, {});
}

function trimString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getUserProjectSlugs(projectIntegrations: ProjectIntegrationsMap): string[] {
  const ids = projectIntegrations[USER_PROJECTS_KEY]?._?.ids;
  return Array.isArray(ids)
    ? ids.filter((value): value is string => typeof value === "string")
    : [];
}

function getProjectDisplayName(
  projectIntegrations: ProjectIntegrationsMap,
  projectSlug: string,
  fallback: string
): string {
  const baseOverride = trimString(projectIntegrations[projectSlug]?._project?.name);
  if (baseOverride) return baseOverride;

  const customOverride = trimString(
    projectIntegrations[`${USER_PROJECT_META_PREFIX}${projectSlug}`]?._?.name
  );
  if (customOverride) return customOverride;

  return fallback;
}

function getUserPlatformIds(
  projectIntegrations: ProjectIntegrationsMap,
  projectSlug: string
): string[] {
  const ids = projectIntegrations[projectSlug]?.[USER_PLATFORM_IDS_KEY]?.ids;
  return Array.isArray(ids)
    ? ids.filter((value): value is string => typeof value === "string")
    : [];
}

function buildUserPlatform(
  projectIntegrations: ProjectIntegrationsMap,
  projectSlug: string,
  platformId: string
): Platform {
  return {
    id: platformId,
    name:
      trimString(
        projectIntegrations[projectSlug]?.[`${USER_PLATFORM_META_PREFIX}${platformId}`]?.name
      ) ?? platformId,
    type:
      (projectIntegrations[projectSlug]?.[`${USER_PLATFORM_META_PREFIX}${platformId}`]?.type as
        | Platform["type"]
        | undefined) ?? "website",
    integrations: {},
  };
}

function getAllProjects(projectIntegrations: ProjectIntegrationsMap): Project[] {
  const baseProjects = PROJECTS.map((project) => ({
    ...project,
    name: getProjectDisplayName(projectIntegrations, project.slug, project.name),
    platforms: [
      ...project.platforms,
      ...getUserPlatformIds(projectIntegrations, project.slug).map((platformId) =>
        buildUserPlatform(projectIntegrations, project.slug, platformId)
      ),
    ],
  }));

  const baseProjectSlugs = new Set(baseProjects.map((project) => project.slug));
  const customProjects = getUserProjectSlugs(projectIntegrations)
    .filter((projectSlug) => !baseProjectSlugs.has(projectSlug))
    .map((projectSlug) => ({
      id: projectSlug,
      slug: projectSlug,
      name: getProjectDisplayName(projectIntegrations, projectSlug, projectSlug),
      color:
        trimString(projectIntegrations[`${USER_PROJECT_META_PREFIX}${projectSlug}`]?._?.color) ??
        "#666666",
      description:
        trimString(
          projectIntegrations[`${USER_PROJECT_META_PREFIX}${projectSlug}`]?._?.description
        ) ?? "",
      platforms: getUserPlatformIds(projectIntegrations, projectSlug).map((platformId) =>
        buildUserPlatform(projectIntegrations, projectSlug, platformId)
      ),
    }));

  return [...baseProjects, ...customProjects];
}

function resolveTargetGitHubRepo(
  projectIntegrations: ProjectIntegrationsMap,
  project: Project,
  platform: Platform
): { owner: string; repo: string } | null {
  const projectConfig = projectIntegrations[project.slug] ?? {};
  const projectOverride = projectConfig._project?.github as
    | { owner?: string; repo?: string }
    | undefined;
  const platformOverride = projectConfig[platform.id]?.github as
    | { owner?: string; repo?: string }
    | undefined;
  const staticConfig = platform.integrations.github;
  const candidate = platformOverride ?? projectOverride ?? staticConfig;
  const owner = trimString(candidate?.owner);
  const repo = trimString(candidate?.repo);
  return owner && repo ? { owner, repo } : null;
}

async function buildImportTargets(watches: PackageWatch[]): Promise<ChangelogImportTarget[]> {
  const projectIntegrations = await getSettingsRepo()
    .getProjectIntegrations()
    .catch(() => ({}));
  const projects = getAllProjects(projectIntegrations);
  const watchCounts = new Map<string, number>();

  for (const watch of watches) {
    const key = `${watch.projectSlug}:${watch.platformId}`;
    watchCounts.set(key, (watchCounts.get(key) ?? 0) + 1);
  }

  return projects.flatMap((project) =>
    project.platforms.map((platform) => {
      const githubRepo = resolveTargetGitHubRepo(projectIntegrations, project, platform);
      return {
        projectSlug: project.slug,
        projectName: project.name,
        projectColor: project.color,
        platformId: platform.id,
        platformName: platform.name,
        githubRepo,
        watchCount: watchCounts.get(`${project.slug}:${platform.id}`) ?? 0,
      };
    })
  );
}

function isVisibleStatus(status: ChangelogWatchStatus): boolean {
  return status === "active" || status === "muted";
}

function filterVisibleEntries(
  entries: ChangelogEntry[],
  watches: PackageWatch[]
): ChangelogEntry[] {
  const visibleWatchIds = new Set(
    watches.filter((watch) => isVisibleStatus(watch.status)).map((watch) => watch.id)
  );

  return entries.filter((entry) => entry.watchIds.some((watchId) => visibleWatchIds.has(watchId)));
}

export async function getChangelogState(): Promise<ChangelogState> {
  const [watches, trackedPackages, entries, syncState, entryMeta] = await Promise.all([
    loadWatches(),
    loadTrackedPackages(),
    loadEntries(),
    loadSyncState(),
    loadEntryMeta(),
  ]);

  return {
    targets: await buildImportTargets(watches),
    watches,
    trackedPackages,
    entries: filterVisibleEntries(entries, watches),
    entryMeta,
    syncState,
  };
}

async function resolveGitHubConfig(): Promise<GitHubConfig> {
  const creds = await getCredentialRepo().getCredential("github");
  return { token: creds?.token ?? creds?.accessToken ?? "" };
}

async function fetchGitHubJson<T>(config: GitHubConfig, path: string): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
  };
  headers["X-GitHub-Api-Version"] = "2022-11-28";
  if (config.token) headers.Authorization = `Bearer ${config.token}`;

  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}) for ${path}`);
  }
  return (await response.json()) as T;
}

async function fetchGitHubText(config: GitHubConfig, path: string): Promise<string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
  };
  headers["X-GitHub-Api-Version"] = "2022-11-28";
  if (config.token) headers.Authorization = `Bearer ${config.token}`;

  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}) for ${path}`);
  }
  const payload = (await response.json()) as GitHubContentResponse;
  if (payload.encoding !== "base64" || !payload.content) {
    throw new Error(`GitHub content payload missing base64 content for ${path}`);
  }
  return Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function parseWorkspacePatterns(manifest: Record<string, unknown>): string[] {
  const workspaces = manifest.workspaces;
  if (Array.isArray(workspaces)) {
    return workspaces.flatMap((value) => (typeof value === "string" ? [value] : []));
  }

  if (workspaces && typeof workspaces === "object") {
    const packages = (workspaces as { packages?: unknown }).packages;
    if (Array.isArray(packages)) {
      return packages.flatMap((value) => (typeof value === "string" ? [value] : []));
    }
  }

  return [];
}

function parsePnpmWorkspacePatterns(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .map((line) => line.replace(/^-+\s*/, "").replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function toRegexPattern(globPattern: string): RegExp {
  const escaped = globPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withPlaceholders = escaped.replace(/\*\*/g, ":::DOUBLE_STAR:::");
  const single = withPlaceholders.replace(/\*/g, "[^/]+");
  return new RegExp(`^${single.replace(/:::DOUBLE_STAR:::/g, ".*")}$`);
}

function packageJsonMatchesWorkspacePattern(path: string, pattern: string): boolean {
  if (path === "package.json") return false;
  const dirPath = path.replace(/\/package\.json$/, "");
  return toRegexPattern(pattern).test(dirPath);
}

function _stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function summarizeBody(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function normalizeVersion(value: string): string {
  return value.replace(/^v/i, "").trim();
}

function isWorkspaceDependency(spec: string): boolean {
  return /^(?:workspace:|file:|link:|portal:)/.test(spec);
}

function parsePackageManifest(raw: string): ParsedPackageManifest {
  const manifest = JSON.parse(raw) as Record<string, unknown>;
  const dependencies = Object.fromEntries(
    Object.entries((manifest.dependencies as Record<string, unknown> | undefined) ?? {}).flatMap(
      ([packageName, value]) =>
        typeof value === "string" && !isWorkspaceDependency(value) ? [[packageName, value]] : []
    )
  );

  return {
    name: trimString(manifest.name),
    dependencies,
    workspacePatterns: parseWorkspacePatterns(manifest),
  };
}

async function getRepoManifestPaths(
  config: GitHubConfig,
  owner: string,
  repo: string
): Promise<{ defaultBranch: string; manifestPaths: string[] }> {
  const repository = await getRepository(config, owner, repo);
  const defaultBranch = trimString(Reflect.get(repository, "default_branch")) ?? "main";
  const tree = await fetchGitHubJson<GitHubTreeResponse>(
    config,
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`
  );
  const packageJsonPaths = (tree.tree ?? [])
    .flatMap((entry) =>
      entry.type === "blob" && typeof entry.path === "string" && entry.path.endsWith("package.json")
        ? [entry.path]
        : []
    )
    .sort((left, right) => left.localeCompare(right));

  const rootManifestRaw = await fetchGitHubText(
    config,
    `/repos/${owner}/${repo}/contents/package.json?ref=${encodeURIComponent(defaultBranch)}`
  );
  const rootManifest = parsePackageManifest(rootManifestRaw);

  let pnpmWorkspaceRaw: string | null = null;
  try {
    pnpmWorkspaceRaw = await fetchGitHubText(
      config,
      `/repos/${owner}/${repo}/contents/pnpm-workspace.yaml?ref=${encodeURIComponent(defaultBranch)}`
    );
  } catch {
    pnpmWorkspaceRaw = null;
  }

  const workspacePatterns = uniqueStrings([
    ...rootManifest.workspacePatterns,
    ...parsePnpmWorkspacePatterns(pnpmWorkspaceRaw),
  ]);

  const workspacePaths =
    workspacePatterns.length === 0
      ? []
      : packageJsonPaths.filter((path) =>
          workspacePatterns.some((pattern) => packageJsonMatchesWorkspacePattern(path, pattern))
        );

  return {
    defaultBranch,
    manifestPaths: uniqueStrings(["package.json", ...workspacePaths]),
  };
}

async function importPackageNamesFromRepo(
  owner: string,
  repo: string
): Promise<{ packageNames: string[]; defaultBranch: string }> {
  const config = await resolveGitHubConfig();
  const { defaultBranch, manifestPaths } = await getRepoManifestPaths(config, owner, repo);
  const manifests = await Promise.all(
    manifestPaths.map(async (path) =>
      parsePackageManifest(
        await fetchGitHubText(
          config,
          `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(defaultBranch)}`
        )
      )
    )
  );

  return {
    defaultBranch,
    packageNames: uniqueStrings(
      manifests.flatMap((manifest) => Object.keys(manifest.dependencies))
    ),
  };
}

function makeWatchId(projectSlug: string, platformId: string, packageName: string): string {
  return `${projectSlug}:${platformId}:${packageName}`;
}

function parseGitHubRepoFromUrl(input: string | null): { owner: string; repo: string } | null {
  if (!input) return null;
  const trimmed = input.trim();
  const shorthand = trimmed.match(/^github:([^/]+)\/([^/]+)$/i);
  if (shorthand) {
    return { owner: shorthand[1] ?? "", repo: (shorthand[2] ?? "").replace(/\.git$/i, "") };
  }

  const normalized = trimmed.replace(/^git\+/, "");

  try {
    const url = new URL(normalized);
    if (!/github\.com$/i.test(url.hostname)) return null;
    const [owner, repo] = url.pathname.replace(/^\/+/, "").split("/");
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/i, "") };
  } catch {
    return null;
  }
}

function packageEntryUrl(packageName: string, version: string): string {
  return `https://www.npmjs.com/package/${encodeURIComponent(packageName)}/v/${encodeURIComponent(version)}`;
}

const metadataCache = new Map<string, { expiresAt: number; value: NpmRegistryResponse }>();
const atomCache = new Map<string, { expiresAt: number; value: string }>();
const EXTERNAL_CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedExternal<T>(
  cache: Map<string, { expiresAt: number; value: T }>,
  key: string
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedExternal<T>(
  cache: Map<string, { expiresAt: number; value: T }>,
  key: string,
  value: T
): void {
  cache.set(key, { value, expiresAt: Date.now() + EXTERNAL_CACHE_TTL_MS });
}

async function fetchNpmRegistryMetadata(packageName: string): Promise<NpmRegistryResponse> {
  const cacheKey = packageName.toLowerCase();
  const cached = getCachedExternal(metadataCache, cacheKey);
  if (cached) return cached;

  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);
  if (!response.ok) {
    throw new Error(`npm registry returned ${response.status} for ${packageName}`);
  }
  const data = (await response.json()) as NpmRegistryResponse;
  setCachedExternal(metadataCache, cacheKey, data);
  return data;
}

async function fetchGitHubReleasesAtom(owner: string, repo: string): Promise<string> {
  const cacheKey = `${owner}/${repo}`.toLowerCase();
  const cached = getCachedExternal(atomCache, cacheKey);
  if (cached) return cached;

  const response = await fetch(`https://github.com/${owner}/${repo}/releases.atom`);
  if (!response.ok) {
    throw new Error(`GitHub releases atom returned ${response.status} for ${owner}/${repo}`);
  }
  const text = await response.text();
  setCachedExternal(atomCache, cacheKey, text);
  return text;
}

function parseAtomRelease(
  xml: string,
  version: string
): {
  title: string;
  body: string;
  bodyFormat: ChangelogBodyFormat;
  publishedAt: string;
  releaseUrl: string | null;
} | null {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const normalizedVersion = normalizeVersion(version);

  for (const entry of entries) {
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
    if (!title || normalizeVersion(title) !== normalizedVersion) continue;

    const updated = entry.match(/<updated>([\s\S]*?)<\/updated>/)?.[1]?.trim() ?? now();
    const link = entry.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? null;
    const content = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? "";
    const decodedContent = decodeHtmlEntities(content);

    return {
      title,
      body: decodedContent,
      bodyFormat: "html",
      publishedAt: updated,
      releaseUrl: link,
    };
  }

  return null;
}

function resolveRepositoryUrl(metadata: NpmRegistryResponse): string | null {
  if (typeof metadata.repository === "string") return metadata.repository;
  if (metadata.repository && typeof metadata.repository === "object") {
    return trimString(metadata.repository.url) ?? null;
  }
  return null;
}

function resolveHomepageUrl(metadata: NpmRegistryResponse): string | null {
  return trimString(metadata.homepage) ?? null;
}

function resolvePrereleaseVersion(metadata: NpmRegistryResponse): string | null {
  const tags = metadata["dist-tags"] ?? {};
  for (const key of ["next", "beta", "rc", "canary", "experimental"]) {
    const value = trimString(tags[key]);
    if (value && value !== trimString(tags.latest)) return value;
  }
  return null;
}

function isNewVersion(previous: string | null, next: string | null): boolean {
  return Boolean(next && normalizeVersion(next) !== normalizeVersion(previous ?? ""));
}

function buildReleaseEntry(input: {
  packageName: string;
  version: string;
  publishedAt: string;
  title: string;
  description: string;
  body?: string | null;
  bodyFormat?: ChangelogBodyFormat;
  sourceType: ChangelogReleaseSource;
  notesQuality: ChangelogNotesQuality;
  releaseUrl: string | null;
  isPrerelease: boolean;
  watchIds: string[];
  projectSlugs: string[];
  platformIds: string[];
}): ChangelogEntry {
  const id = `release:${slugifyPackageName(input.packageName)}:${normalizeVersion(input.version)}`;

  return {
    id,
    title: input.title,
    description: input.description,
    body: input.body ?? input.description,
    bodyFormat: input.bodyFormat ?? "text",
    version: input.version,
    packageName: input.packageName,
    date: today(input.publishedAt),
    type: "release",
    sourceType: input.sourceType,
    notesQuality: input.notesQuality,
    releaseUrl: input.releaseUrl,
    publishedAt: input.publishedAt,
    isPrerelease: input.isPrerelease,
    watchIds: uniqueStrings(input.watchIds),
    projectSlugs: uniqueStrings(input.projectSlugs),
    platformIds: uniqueStrings(input.platformIds),
    projectId: input.projectSlugs[0] ?? undefined,
    createdAt: now(),
  };
}

async function tryGitHubApiRelease(
  packageName: string,
  stableVersion: string,
  stablePublishedAt: string,
  githubRepo: { owner: string; repo: string },
  watches: PackageWatch[]
): Promise<ChangelogEntry | null> {
  const config = await resolveGitHubConfig();
  const releases = await getRecentReleases(config, githubRepo.owner, githubRepo.repo, 10);
  const release = releases.find(
    (item) =>
      !item.draft &&
      normalizeVersion(trimString(Reflect.get(item, "tag_name")) ?? "") ===
        normalizeVersion(stableVersion)
  );
  if (!release) return null;

  const releaseBody = release.body?.trim() ?? null;
  return buildReleaseEntry({
    packageName,
    version: stableVersion,
    publishedAt: release.published_at ?? stablePublishedAt,
    title: release.name?.trim() || `${packageName} ${stableVersion}`,
    description: summarizeBody(releaseBody) || `Published ${stableVersion} on GitHub Releases.`,
    body: releaseBody ?? `Published ${stableVersion} on GitHub Releases.`,
    bodyFormat: releaseBody ? "markdown" : "text",
    sourceType: "github_release",
    notesQuality: releaseBody ? "full" : "minimal",
    releaseUrl: release.html_url,
    isPrerelease: false,
    watchIds: watches.map((watch) => watch.id),
    projectSlugs: watches.map((watch) => watch.projectSlug),
    platformIds: watches.map((watch) => watch.platformId),
  });
}

async function tryGitHubAtomRelease(
  packageName: string,
  stableVersion: string,
  githubRepo: { owner: string; repo: string },
  watches: PackageWatch[]
): Promise<ChangelogEntry | null> {
  const atom = await fetchGitHubReleasesAtom(githubRepo.owner, githubRepo.repo);
  const atomRelease = parseAtomRelease(atom, stableVersion);
  if (!atomRelease) return null;

  return buildReleaseEntry({
    packageName,
    version: stableVersion,
    publishedAt: atomRelease.publishedAt,
    title: atomRelease.title,
    description:
      summarizeBody(atomRelease.body) || `Published ${stableVersion} via GitHub releases feed.`,
    body: atomRelease.body || `Published ${stableVersion} via GitHub releases feed.`,
    bodyFormat: atomRelease.bodyFormat,
    sourceType: "github_atom",
    notesQuality: atomRelease.body ? "full" : "minimal",
    releaseUrl: atomRelease.releaseUrl,
    isPrerelease: false,
    watchIds: watches.map((watch) => watch.id),
    projectSlugs: watches.map((watch) => watch.projectSlug),
    platformIds: watches.map((watch) => watch.platformId),
  });
}

async function resolveStableEntry(
  packageName: string,
  stableVersion: string,
  stablePublishedAt: string,
  githubRepo: { owner: string; repo: string } | null,
  watches: PackageWatch[],
  fallbackEntry: ChangelogEntry
): Promise<ChangelogEntry> {
  if (!githubRepo) return fallbackEntry;

  try {
    const apiRelease = await tryGitHubApiRelease(
      packageName,
      stableVersion,
      stablePublishedAt,
      githubRepo,
      watches
    );
    if (apiRelease) return apiRelease;

    try {
      const atomRelease = await tryGitHubAtomRelease(
        packageName,
        stableVersion,
        githubRepo,
        watches
      );
      if (atomRelease) return atomRelease;
    } catch {
      // fall back to npm minimal entry
    }
  } catch {
    // fall back to npm minimal entry
  }

  return fallbackEntry;
}

function buildTrackedPackage(params: {
  packageName: string;
  homepageUrl: string | null;
  repositoryUrl: string | null;
  releaseSource: ChangelogReleaseSource;
  notesQuality: ChangelogNotesQuality;
  githubRepo: { owner: string; repo: string } | null;
  stableVersion: string | undefined;
  prereleaseVersion: string | null;
  stablePublishedAt: string;
  existingTracked: TrackedPackage | undefined;
}): TrackedPackage {
  const { packageName, existingTracked } = params;
  return {
    packageName,
    npmUrl: `https://www.npmjs.com/package/${encodeURIComponent(packageName)}`,
    homepageUrl: params.homepageUrl,
    repositoryUrl: params.repositoryUrl,
    releaseSource: params.releaseSource,
    notesQuality: params.notesQuality,
    githubRepo: params.githubRepo,
    lastStableVersion: params.stableVersion ?? existingTracked?.lastStableVersion ?? null,
    lastPrereleaseVersion:
      params.prereleaseVersion ?? existingTracked?.lastPrereleaseVersion ?? null,
    lastPublishedAt: params.stablePublishedAt ?? existingTracked?.lastPublishedAt ?? null,
    lastSyncedAt: now(),
    createdAt: existingTracked?.createdAt ?? now(),
    updatedAt: now(),
  };
}

function buildMinimalReleaseEntry(
  packageName: string,
  version: string,
  publishedAt: string,
  isPrerelease: boolean,
  watches: PackageWatch[]
): ChangelogEntry {
  return buildReleaseEntry({
    packageName,
    version,
    publishedAt,
    title: `${packageName} ${version}`,
    description: `Published ${version} on npm.`,
    body: `Published ${version} on npm.`,
    bodyFormat: "text",
    sourceType: "npm_publish",
    notesQuality: "minimal",
    releaseUrl: packageEntryUrl(packageName, version),
    isPrerelease,
    watchIds: watches.map((watch) => watch.id),
    projectSlugs: watches.map((watch) => watch.projectSlug),
    platformIds: watches.map((watch) => watch.platformId),
  });
}

async function resolvePackageSnapshot(
  packageName: string,
  existingTracked: TrackedPackage | undefined,
  watches: PackageWatch[]
): Promise<ResolvedPackageSnapshot> {
  const metadata = await fetchNpmRegistryMetadata(packageName);
  const stableVersion = trimString(metadata["dist-tags"]?.latest);
  const prereleaseVersion = resolvePrereleaseVersion(metadata);
  const stablePublishedAt = stableVersion ? (metadata.time?.[stableVersion] ?? now()) : now();
  const prereleasePublishedAt = prereleaseVersion
    ? (metadata.time?.[prereleaseVersion] ?? now())
    : null;
  const repositoryUrl = resolveRepositoryUrl(metadata);
  const homepageUrl = resolveHomepageUrl(metadata);
  const githubRepo = parseGitHubRepoFromUrl(repositoryUrl ?? homepageUrl);

  const nextEntries: ChangelogEntry[] = [];
  let releaseSource: ChangelogReleaseSource = "npm_publish";
  let notesQuality: ChangelogNotesQuality = "minimal";

  const buildMinimalEntry = (version: string, publishedAt: string, isPrerelease: boolean) =>
    buildMinimalReleaseEntry(packageName, version, publishedAt, isPrerelease, watches);

  if (stableVersion && isNewVersion(existingTracked?.lastStableVersion ?? null, stableVersion)) {
    const stableEntry = await resolveStableEntry(
      packageName,
      stableVersion,
      stablePublishedAt,
      githubRepo,
      watches,
      buildMinimalEntry(stableVersion, stablePublishedAt, false)
    );

    releaseSource = stableEntry.sourceType;
    notesQuality = stableEntry.notesQuality;
    nextEntries.push(stableEntry);
  }

  const wantsPrereleases = watches.some(
    (watch) => watch.includePrereleases && watch.status !== "disabled"
  );
  const hasPrereleaseUpdate =
    wantsPrereleases &&
    prereleaseVersion &&
    prereleasePublishedAt &&
    isNewVersion(existingTracked?.lastPrereleaseVersion ?? null, prereleaseVersion);

  if (hasPrereleaseUpdate) {
    nextEntries.push(buildMinimalEntry(prereleaseVersion, prereleasePublishedAt, true));
  }

  const tracked = buildTrackedPackage({
    packageName,
    homepageUrl,
    repositoryUrl,
    releaseSource,
    notesQuality,
    githubRepo,
    stableVersion: stableVersion ?? undefined,
    prereleaseVersion: hasPrereleaseUpdate ? prereleaseVersion : null,
    stablePublishedAt,
    existingTracked,
  });

  return { tracked, entries: nextEntries };
}

function mergeEntry(existing: ChangelogEntry | undefined, next: ChangelogEntry): ChangelogEntry {
  if (!existing) return next;

  return {
    ...existing,
    ...next,
    watchIds: uniqueStrings([...existing.watchIds, ...next.watchIds]),
    projectSlugs: uniqueStrings([...existing.projectSlugs, ...next.projectSlugs]),
    platformIds: uniqueStrings([...existing.platformIds, ...next.platformIds]),
  };
}

function shouldSkipSync(syncState: ChangelogSyncState, force: boolean | undefined): boolean {
  if (force) return false;
  if (!syncState.lastSuccessAt) return false;
  return Date.now() - Date.parse(syncState.lastSuccessAt) < CHANGELOG_SYNC_INTERVAL_MS;
}

export async function syncChangelog(options: SyncOptions = {}): Promise<ChangelogState> {
  const [watches, trackedPackages, entries, syncState] = await Promise.all([
    loadWatches(),
    loadTrackedPackages(),
    loadEntries(),
    loadSyncState(),
  ]);

  const activeWatches = watches.filter((watch) => watch.status !== "disabled");
  if (activeWatches.length === 0) {
    const nextSyncState: ChangelogSyncState = {
      lastRunAt: now(),
      lastSuccessAt: now(),
      activeWatchCount: 0,
    };
    await saveSyncState(nextSyncState);
    return getChangelogState();
  }

  if (shouldSkipSync(syncState, options.force)) {
    return getChangelogState();
  }

  const packageWatchMap = new Map<string, PackageWatch[]>();
  for (const watch of activeWatches) {
    const list = packageWatchMap.get(watch.packageName) ?? [];
    list.push(watch);
    packageWatchMap.set(watch.packageName, list);
  }

  const trackedByName = new Map(trackedPackages.map((item) => [item.packageName, item]));
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const nextTrackedPackages = new Map(trackedByName);

  for (const [packageName, packageWatches] of packageWatchMap) {
    try {
      const snapshot = await resolvePackageSnapshot(
        packageName,
        trackedByName.get(packageName),
        packageWatches
      );
      nextTrackedPackages.set(packageName, snapshot.tracked);
      for (const entry of snapshot.entries) {
        entryMap.set(entry.id, mergeEntry(entryMap.get(entry.id), entry));
      }
    } catch {
      const existing = trackedByName.get(packageName);
      if (existing) {
        nextTrackedPackages.set(packageName, {
          ...existing,
          updatedAt: now(),
          lastSyncedAt: now(),
        });
      }
    }
  }

  const nextSyncState: ChangelogSyncState = {
    lastRunAt: now(),
    lastSuccessAt: now(),
    activeWatchCount: activeWatches.length,
  };

  await Promise.all([
    saveTrackedPackages(Array.from(nextTrackedPackages.values())),
    saveEntries(Array.from(entryMap.values())),
    saveSyncState(nextSyncState),
  ]);

  return getChangelogState();
}

export async function importChangelogDependencies(input: {
  projectSlug: string;
  platformId: string;
}): Promise<ChangelogState> {
  const projectIntegrations = await getSettingsRepo()
    .getProjectIntegrations()
    .catch(() => ({}));
  const projects = getAllProjects(projectIntegrations);
  const project = projects.find((candidate) => candidate.slug === input.projectSlug);
  const platform = project?.platforms.find((candidate) => candidate.id === input.platformId);

  if (!project || !platform) {
    throw new Error("Project platform not found");
  }

  const githubRepo = resolveTargetGitHubRepo(projectIntegrations, project, platform);
  if (!githubRepo) {
    throw new Error("Selected platform does not have a GitHub repository configured");
  }

  const { packageNames } = await importPackageNamesFromRepo(githubRepo.owner, githubRepo.repo);
  const existingWatches = await loadWatches();
  const nowValue = now();

  const nextWatches = existingWatches.filter((watch) => {
    if (watch.projectSlug !== input.projectSlug || watch.platformId !== input.platformId)
      return true;
    if (watch.source !== "import") return true;
    return packageNames.includes(watch.packageName);
  });

  for (const packageName of packageNames) {
    const id = makeWatchId(project.slug, platform.id, packageName);
    const existing = existingWatches.find((watch) => watch.id === id);
    nextWatches.push(
      existing
        ? {
            ...existing,
            lastImportedAt: nowValue,
            updatedAt: nowValue,
          }
        : {
            id,
            projectSlug: project.slug,
            projectName: project.name,
            platformId: platform.id,
            platformName: platform.name,
            packageName,
            source: "import",
            status: "active",
            includePrereleases: false,
            createdAt: nowValue,
            lastImportedAt: nowValue,
            updatedAt: nowValue,
          }
    );
  }

  await saveWatches(
    stableSort(
      Array.from(new Map(nextWatches.map((watch) => [watch.id, watch])).values()),
      (watch) => watch.id
    )
  );

  return syncChangelog({ force: true });
}
