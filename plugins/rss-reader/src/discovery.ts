const FEED_REQUEST_ACCEPT_HEADER = [
  "application/rss+xml",
  "application/atom+xml",
  "application/xml;q=0.9",
  "text/xml;q=0.8",
  "text/html;q=0.7",
  "*/*;q=0.5",
].join(", ");

const FALLBACK_FEED_PATHS = ["/feed", "/feed.xml", "/rss", "/rss.xml", "/atom.xml", "/index.xml"];

type FeedDiscoveryErrorCode = "invalid_url" | "fetch_failed" | "feed_not_found";
type FeedDiscoveryMethod = "direct" | "html_link" | "fallback";

export class FeedDiscoveryError extends Error {
  constructor(
    readonly code: FeedDiscoveryErrorCode,
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "FeedDiscoveryError";
  }
}

export interface FeedDiscoveryResult {
  requestedUrl: string;
  feedUrl: string;
  method: FeedDiscoveryMethod;
}

interface FetchedDocument {
  body: string;
  contentType: string;
  finalUrl: string;
}

function parseHttpUrl(input: string): URL {
  let url: URL;

  try {
    url = new URL(input);
  } catch (error) {
    throw new FeedDiscoveryError("invalid_url", "Invalid URL", error);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FeedDiscoveryError("invalid_url", "Only http(s) URLs are supported");
  }

  return url;
}

function normalizeContentType(contentType: string | null): string {
  return contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function isXmlContentType(contentType: string): boolean {
  return (
    contentType === "application/rss+xml" ||
    contentType === "application/atom+xml" ||
    contentType === "application/xml" ||
    contentType === "text/xml" ||
    contentType.endsWith("+xml")
  );
}

function looksLikeFeedDocument(body: string): boolean {
  const trimmed = body.trimStart().replace(/^\uFEFF/, "");
  return /^(?:<\?xml[\s\S]*?\?>\s*)?<(rss|feed|rdf:RDF)\b/i.test(trimmed);
}

function isFeedDocument(doc: FetchedDocument): boolean {
  return isXmlContentType(doc.contentType) && looksLikeFeedDocument(doc.body);
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

  for (const match of tag.matchAll(attrRegex)) {
    const name = match[1]?.toLowerCase();
    if (!name || name === "link") continue;
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attributes[name] = value;
  }

  return attributes;
}

function relIncludesAlternate(rel: string): boolean {
  return rel.toLowerCase().split(/\s+/).filter(Boolean).includes("alternate");
}

function looksLikeFeedHref(href: string): boolean {
  return /(?:\/|^)(?:feed|rss|atom)(?:[/.?#]|$)|\.xml(?:[?#]|$)/i.test(href);
}

function extractFeedLinks(html: string, baseUrl: URL): URL[] {
  const candidates = new Set<string>();

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const attrs = parseAttributes(tag);
    const href = attrs.href?.trim();
    const rel = attrs.rel?.trim() ?? "";
    const type = normalizeContentType(attrs.type ?? "");

    if (!href || !relIncludesAlternate(rel)) continue;
    if (!isXmlContentType(type) && !looksLikeFeedHref(href)) continue;

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
      candidates.add(resolved.toString());
    } catch {
      // Ignore malformed feed links in page markup.
    }
  }

  return [...candidates].map((candidate) => new URL(candidate));
}

async function fetchDocument(url: URL, fetchImpl: typeof fetch): Promise<FetchedDocument | null> {
  let response: Response;

  try {
    response = await fetchImpl(url.toString(), {
      headers: {
        accept: FEED_REQUEST_ACCEPT_HEADER,
      },
      redirect: "follow",
    });
  } catch (error) {
    throw new FeedDiscoveryError("fetch_failed", `Failed to fetch ${url.toString()}`, error);
  }

  if (!response.ok) return null;

  return {
    body: await response.text(),
    contentType: normalizeContentType(response.headers.get("content-type")),
    finalUrl: response.url || url.toString(),
  };
}

async function resolveCandidateFeed(
  candidateUrl: URL,
  method: Exclude<FeedDiscoveryMethod, "direct">,
  fetchImpl: typeof fetch
): Promise<FeedDiscoveryResult | null> {
  const doc = await fetchDocument(candidateUrl, fetchImpl);
  if (!doc || !isFeedDocument(doc)) return null;

  return {
    requestedUrl: candidateUrl.toString(),
    feedUrl: doc.finalUrl,
    method,
  };
}

export async function discoverFeedFromUrl(
  input: string,
  fetchImpl: typeof fetch = fetch
): Promise<FeedDiscoveryResult> {
  const requestedUrl = parseHttpUrl(input);
  const requestedUrlString = requestedUrl.toString();
  const initialDoc = await fetchDocument(requestedUrl, fetchImpl);

  if (!initialDoc) {
    throw new FeedDiscoveryError("fetch_failed", `Failed to fetch ${requestedUrlString}`);
  }

  if (isFeedDocument(initialDoc)) {
    return {
      requestedUrl: requestedUrlString,
      feedUrl: initialDoc.finalUrl,
      method: "direct",
    };
  }

  const finalPageUrl = new URL(initialDoc.finalUrl);
  const linkedCandidates = extractFeedLinks(initialDoc.body, finalPageUrl);
  for (const candidate of linkedCandidates) {
    const discovered = await resolveCandidateFeed(candidate, "html_link", fetchImpl);
    if (discovered) {
      return {
        ...discovered,
        requestedUrl: requestedUrlString,
      };
    }
  }

  const rootUrl = new URL("/", finalPageUrl.origin);
  for (const path of FALLBACK_FEED_PATHS) {
    const candidate = new URL(path, rootUrl);
    const discovered = await resolveCandidateFeed(candidate, "fallback", fetchImpl);
    if (discovered) {
      return {
        ...discovered,
        requestedUrl: requestedUrlString,
      };
    }
  }

  throw new FeedDiscoveryError(
    "feed_not_found",
    `No RSS or Atom feed found for ${requestedUrl.host}`
  );
}
