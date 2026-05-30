import { site } from "@/data/site";

const desktopReleaseTagPattern = /^desktop-v\d+\.\d+\.\d+(?:-beta\.\d+)?$/;
const stableReleaseTagPattern = /^desktop-v\d+\.\d+\.\d+$/;
const betaReleaseTagPattern = /^desktop-v\d+\.\d+\.\d+-beta\.\d+$/;

type GitHubReleaseAsset = Record<string, unknown>;
type GitHubRelease = Record<string, unknown>;

export type DesktopRelease = {
  tag: string;
  name: string;
  version: string;
  url: string;
  downloadUrl: string;
  publishedAt: string | null;
  channel: "beta" | "stable";
};

export type DesktopReleaseState = {
  beta: DesktopRelease | null;
  stable: DesktopRelease | null;
  unavailable: boolean;
};

export type DesktopReleaseAction = {
  label: "Download macOS beta" | "Download latest for macOS" | "Join macOS beta";
  href: string;
  caption: string;
  external: boolean;
  release: DesktopRelease | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  return typeof value === "string" ? value : null;
}

function getBooleanField(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true;
}

function getAssets(record: Record<string, unknown>): GitHubReleaseAsset[] {
  const assets = record.assets;

  return Array.isArray(assets) ? assets.filter(isRecord) : [];
}

function getReleaseTag(release: GitHubRelease): string {
  return getStringField(release, "tag_name") ?? "";
}

function getAuthHeaders(): Headers {
  // biome-ignore lint/style/noProcessEnv: GitHub release access is configured by deployment env.
  const environment = process.env;
  const token = environment.GITHUB_RELEASES_TOKEN ?? environment.GITHUB_TOKEN;
  const headers = new Headers();

  headers.set("Accept", "application/vnd.github+json");

  if (!token) {
    return headers;
  }

  headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-GitHub-Api-Version", "2022-11-28");

  return headers;
}

function toDesktopRelease(release: GitHubRelease, channel: DesktopRelease["channel"]) {
  const tag = getReleaseTag(release);
  const name = getStringField(release, "name");
  const url = getStringField(release, "html_url") ?? site.links.releases;
  const publishedAt = getStringField(release, "published_at");
  const dmgAsset = getAssets(release).find((asset) =>
    getStringField(asset, "name")?.toLowerCase().endsWith(".dmg")
  );
  const downloadUrl = dmgAsset ? (getStringField(dmgAsset, "browser_download_url") ?? url) : url;

  return {
    tag,
    name: name ?? tag,
    version: tag.replace("desktop-v", ""),
    url,
    downloadUrl,
    publishedAt,
    channel,
  } satisfies DesktopRelease;
}

export async function getDesktopReleaseState(): Promise<DesktopReleaseState> {
  try {
    const response = await fetch(
      "https://api.github.com/repos/Radarboard/radarboard/releases?per_page=50",
      {
        headers: getAuthHeaders(),
        next: { revalidate: 900 },
      }
    );

    if (!response.ok) {
      return { beta: null, stable: null, unavailable: true };
    }

    const json = await response.json();
    const releases = Array.isArray(json) ? json.filter(isRecord) : [];
    const publishedDesktopReleases = releases.filter(
      (release) =>
        !getBooleanField(release, "draft") && desktopReleaseTagPattern.test(getReleaseTag(release))
    );

    const stable = publishedDesktopReleases.find(
      (release) =>
        !getBooleanField(release, "prerelease") &&
        stableReleaseTagPattern.test(getReleaseTag(release))
    );
    const beta = publishedDesktopReleases.find(
      (release) =>
        getBooleanField(release, "prerelease") && betaReleaseTagPattern.test(getReleaseTag(release))
    );

    return {
      stable: stable ? toDesktopRelease(stable, "stable") : null,
      beta: beta ? toDesktopRelease(beta, "beta") : null,
      unavailable: false,
    };
  } catch {
    return { beta: null, stable: null, unavailable: true };
  }
}

export function getDesktopReleaseAction(state: DesktopReleaseState): DesktopReleaseAction {
  const betaPublishedAt = state.beta?.publishedAt ? Date.parse(state.beta.publishedAt) : 0;
  const stablePublishedAt = state.stable?.publishedAt ? Date.parse(state.stable.publishedAt) : 0;

  if (state.beta && (!state.stable || betaPublishedAt >= stablePublishedAt)) {
    return {
      label: "Download macOS beta",
      href: state.beta.downloadUrl,
      caption: `Published macOS desktop beta: ${state.beta.version}.`,
      external: true,
      release: state.beta,
    };
  }

  if (state.stable) {
    return {
      label: "Download latest for macOS",
      href: state.stable.downloadUrl,
      caption: `Latest published macOS desktop release: ${state.stable.version}.`,
      external: true,
      release: state.stable,
    };
  }

  return {
    label: "Join macOS beta",
    href: site.links.beta,
    caption: "macOS beta access is opening now. Join the list for the first public Mac build.",
    external: false,
    release: null,
  };
}
