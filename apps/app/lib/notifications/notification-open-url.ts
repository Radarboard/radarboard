import type { NotificationFeedItem, NotificationMetadata } from "@radarboard/types/notifications";

/** Common top-level keys integrations and plugins use for a primary browser URL. */
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
  const t = value.trim();
  if (!t.startsWith("http://") && !t.startsWith("https://")) return null;
  try {
    new URL(t);
    return t;
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
    const u = readHttpUrl(metadata[key]);
    if (u && !isLikelyNonPrimaryLink(u)) return u;
  }
  return null;
}

function urlFromTopLevelKeysAny(metadata: Record<string, unknown>): string | null {
  for (const key of TOP_LEVEL_URL_KEYS) {
    const u = readHttpUrl(metadata[key]);
    if (u) return u;
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

  if (value === null || value === undefined) return;
  if (typeof value !== "object") return;

  budget.remaining--;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectUrlsFromValue(value[i], depth - 1, [...path, String(i)], out, budget);
      if (budget.remaining <= 0) return;
    }
    return;
  }

  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  for (const key of keys) {
    collectUrlsFromValue(o[key], depth - 1, [...path, key], out, budget);
    if (budget.remaining <= 0) return;
  }
}

function segmentLooksLinkRelated(segment: string): boolean {
  const s = segment.toLowerCase();
  if (/(^|_)(url|link|href|permalink|uri|browser|dashboard|webview)(_|$)/.test(s)) {
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
  for (const c of candidates) {
    if (!deduped.has(c.url)) deduped.set(c.url, c);
  }
  const unique = [...deduped.values()];

  const primary = unique.filter((c) => !isLikelyNonPrimaryLink(c.url));
  const pool = primary.length > 0 ? primary : unique;

  return (
    pool
      .map((c) => ({
        url: c.url,
        hint: pathHintScore(c.path),
        https: c.url.startsWith("https:"),
        len: c.url.length,
      }))
      .sort((a, b) => {
        if (a.hint !== b.hint) return b.hint - a.hint;
        if (a.https !== b.https) return a.https ? -1 : 1;
        return b.len - a.len;
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
  if (match) {
    return readHttpUrl(match[0]) ?? match[0].trim();
  }
  return null;
}

function githubRepoUrl(metadata: Record<string, unknown>): string | null {
  const repo = metadata.repo;
  if (typeof repo !== "string" || !repo.includes("/")) return null;
  return `https://github.com/${repo}`;
}

/**
 * Best URL to open for a feed item (new tab), or null if none is known.
 *
 * Resolution order:
 * 1. Well-known top-level metadata keys (`url`, `permalink`, `issueUrl`, …).
 * 2. Any `http(s)` string anywhere in `metadata` (depth-limited), preferring keys whose
 *    names look link-like (`*url*`, `*permalink*`, …) over e.g. avatar URLs.
 * 3. First URL in `body`, then in `title`.
 * 4. GitHub-only: `metadata.repo` → `https://github.com/{repo}`.
 *
 * Plugins and integrations can rely on `metadata.url` or nest a link under descriptive keys.
 */
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
