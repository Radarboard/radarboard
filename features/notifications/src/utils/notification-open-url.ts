import type { NotificationFeedItem, NotificationMetadata } from "@radarboard/types/notifications";

const TOP_LEVEL_URL_KEYS = [
  "url",
  "link",
  "href",
  "htmlUrl",
  "html_url",
  "permalink",
  "webUrl",
  "web_url",
  "browserUrl",
  "browser_url",
  "openUrl",
  "open_url",
  "actionUrl",
  "action_url",
  "targetUrl",
  "target_url",
  "deepLink",
  "deep_link",
  "dashboardUrl",
  "dashboard_url",
  "issueUrl",
  "issue_url",
  "pullRequestUrl",
  "pull_request_url",
] as const;

const MAX_METADATA_NODES = 120;
const MAX_METADATA_DEPTH = 5;

function readHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return null;
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

function isLikelyNonPrimaryLink(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("gravatar.com") || host === "avatars.githubusercontent.com";
  } catch {
    return false;
  }
}

function urlFromTopLevelKeysPreferred(metadata: Record<string, unknown>): string | null {
  for (const key of TOP_LEVEL_URL_KEYS) {
    const url = readHttpUrl(metadata[key]);
    if (url && !isLikelyNonPrimaryLink(url)) return url;
  }
  return null;
}

function urlFromTopLevelKeysAny(metadata: Record<string, unknown>): string | null {
  for (const key of TOP_LEVEL_URL_KEYS) {
    const url = readHttpUrl(metadata[key]);
    if (url) return url;
  }
  return null;
}

type UrlCandidate = { url: string; path: string[] };

function collectUrlsFromValue(
  value: unknown,
  depth: number,
  path: string[],
  out: UrlCandidate[],
  budget: { remaining: number }
): void {
  if (budget.remaining <= 0 || depth < 0) return;

  const direct = readHttpUrl(value);
  if (direct) {
    budget.remaining--;
    out.push({ url: direct, path: [...path] });
    return;
  }

  if (value === null || value === undefined || typeof value !== "object") return;

  budget.remaining--;

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      collectUrlsFromValue(value[index], depth - 1, [...path, String(index)], out, budget);
      if (budget.remaining <= 0) return;
    }
    return;
  }

  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort();
  for (const key of keys) {
    collectUrlsFromValue(objectValue[key], depth - 1, [...path, key], out, budget);
    if (budget.remaining <= 0) return;
  }
}

function segmentLooksLinkRelated(segment: string): boolean {
  const value = segment.toLowerCase();
  if (/(^|_)(url|link|href|permalink|uri|browser|dashboard|webview)(_|$)/.test(value)) {
    return true;
  }
  return /(url|link|href|permalink)$/i.test(segment);
}

function pathHintScore(path: string[]): number {
  let score = 0;
  for (const segment of path) {
    if (segmentLooksLinkRelated(segment)) score += 2;
  }
  return score;
}

function pickBestNestedUrl(candidates: UrlCandidate[]): string | null {
  if (candidates.length === 0) return null;

  const deduped = new Map<string, UrlCandidate>();
  for (const candidate of candidates) {
    if (!deduped.has(candidate.url)) deduped.set(candidate.url, candidate);
  }

  const unique = [...deduped.values()];
  const primary = unique.filter((candidate) => !isLikelyNonPrimaryLink(candidate.url));
  const pool = primary.length > 0 ? primary : unique;

  return (
    pool
      .map((candidate) => ({
        url: candidate.url,
        hint: pathHintScore(candidate.path),
        https: candidate.url.startsWith("https:"),
        len: candidate.url.length,
      }))
      .sort((left, right) => {
        if (left.hint !== right.hint) return right.hint - left.hint;
        if (left.https !== right.https) return left.https ? -1 : 1;
        return right.len - left.len;
      })[0]?.url ?? null
  );
}

function urlFromMetadataTree(metadata: NotificationMetadata): string | null {
  const out: UrlCandidate[] = [];
  collectUrlsFromValue(metadata, MAX_METADATA_DEPTH, [], out, { remaining: MAX_METADATA_NODES });
  return pickBestNestedUrl(out);
}

function extractUrlFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  const direct = readHttpUrl(trimmed);
  if (direct) return direct;
  const match = trimmed.match(/https?:\/\/[^\s)\]>'"]+/);
  if (!match) return null;
  return readHttpUrl(match[0]) ?? match[0].trim();
}

function githubRepoUrl(metadata: Record<string, unknown>): string | null {
  const repo = metadata.repo;
  if (typeof repo !== "string" || !repo.includes("/")) return null;
  return `https://github.com/${repo}`;
}

export function getNotificationOpenUrl(item: NotificationFeedItem): string | null {
  const meta = item.metadata as Record<string, unknown>;

  const fromTopPreferred = urlFromTopLevelKeysPreferred(meta);
  if (fromTopPreferred) return fromTopPreferred;

  const fromTree = urlFromMetadataTree(item.metadata);
  if (fromTree) return fromTree;

  const fromBody = extractUrlFromText(item.body);
  if (fromBody) return fromBody;

  const fromTitle = extractUrlFromText(item.title);
  if (fromTitle) return fromTitle;

  const fromTopAny = urlFromTopLevelKeysAny(meta);
  if (fromTopAny) return fromTopAny;

  if (item.source === "github") {
    const repoUrl = githubRepoUrl(meta);
    if (repoUrl) return repoUrl;
  }

  return null;
}
