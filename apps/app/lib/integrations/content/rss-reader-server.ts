import "@/lib/integrations-init";
import { createHash } from "node:crypto";
import { Readability } from "@mozilla/readability";
import { INTEGRATION_REGISTRY } from "@radarboard/integration-sdk/registry";
import type { PluginUserConfig } from "@radarboard/plugin-sdk/types";
import type { RssFeed, RssItem } from "@radarboard/types/rss";
import { DB_KEYS, RSS_PLUGIN_ID } from "@radarboard/types/rss";
import { XMLParser } from "fast-xml-parser";
import { JSDOM } from "jsdom";
import sanitizeHtml from "sanitize-html";
import TurndownService from "turndown";
import { getPluginRepo } from "@/data/core/repository";
import {
  INTEGRATION_RSS_FEEDS_KEY,
  type IntegrationRssFeedOverrides,
  resolveIntegrationRssFeedUrl,
} from "@/lib/integration-rss-feeds";
import { emitNotificationEvent } from "@/lib/notifications/notifications";

const SYSTEM_PLUGIN_ID = "_system";
const RSS_FETCH_TIMEOUT_MS = 15_000;
const MAX_ITEMS_PER_FEED = 50;

// ---------------------------------------------------------------------------
// Circuit breaker — skip feeds that have failed consecutively.
// After CIRCUIT_BREAKER_THRESHOLD failures, the feed is skipped for
// CIRCUIT_BREAKER_COOLDOWN_MS before being retried.
// ---------------------------------------------------------------------------
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

interface CircuitState {
  failures: number;
  lastFailedAt: number;
}

const circuitStates = new Map<string, CircuitState>();

function isCircuitOpen(feedUrl: string): boolean {
  const state = circuitStates.get(feedUrl);
  if (!state || state.failures < CIRCUIT_BREAKER_THRESHOLD) return false;
  return Date.now() - state.lastFailedAt < CIRCUIT_BREAKER_COOLDOWN_MS;
}

function recordSuccess(feedUrl: string): void {
  circuitStates.delete(feedUrl);
}

function recordFailure(feedUrl: string): void {
  const state = circuitStates.get(feedUrl);
  circuitStates.set(feedUrl, {
    failures: (state?.failures ?? 0) + 1,
    lastFailedAt: Date.now(),
  });
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
  parseTagValue: false,
  cdataPropName: "__cdata",
});

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

interface ParsedFeedItem {
  externalId: string;
  title: string;
  link: string;
  publishedAt: string;
  author: string | null;
  excerpt: string | null;
  content: string | null;
  thumbnailUrl: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
}

interface ParsedFeed {
  title: string | null;
  items: ParsedFeedItem[];
}

function now(): string {
  return new Date().toISOString();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function stripHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  const withoutTags = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .trim();

  const normalized = normalizeWhitespace(decodeHtmlEntities(withoutTags));
  return normalized.length > 0 ? normalized : null;
}

function sanitizeReaderHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  const sanitized = sanitizeHtml(decodeHtmlEntities(value), {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "figure",
      "figcaption",
      "pre",
      "code",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
  }).trim();

  return sanitized.length > 0 ? sanitized : null;
}

function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function firstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const normalized = normalizeWhitespace(value);
      if (normalized) return normalized;
      continue;
    }

    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const nested = firstString(record["#text"], record.__cdata, record.value, record.name);
      if (nested) return nested;
    }
  }

  return null;
}

function firstRawString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }

    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const nested = firstRawString(record["#text"], record.__cdata, record.value, record.name);
      if (nested) return nested;
    }
  }

  return null;
}

function atomLinkHref(candidate: unknown): string | null {
  if (typeof candidate === "string") {
    return candidate;
  }

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const rel = typeof record.rel === "string" ? record.rel : "alternate";
  if (rel === "alternate" && typeof record.href === "string") {
    return record.href;
  }

  return typeof record.href === "string" ? record.href : null;
}

function resolveAtomLink(value: unknown): string | null {
  for (const candidate of ensureArray(value)) {
    const href = atomLinkHref(candidate);
    if (href) return href;
  }

  return null;
}

function normalizeDate(value: string | null): string {
  if (!value) return now();
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? now() : new Date(timestamp).toISOString();
}

function resolveAbsoluteUrl(baseUrl: string, value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeImageUrl(url: string | null): string | null {
  if (!url) return null;
  const normalized = url.trim();
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (
    lowered.endsWith(".svg") ||
    lowered.includes("/avatar") ||
    lowered.includes("/logo") ||
    lowered.includes("gravatar")
  ) {
    return null;
  }
  return normalized;
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function imageDimensionsFromValue(value: unknown): { width: number | null; height: number | null } {
  if (!value || typeof value !== "object") {
    return { width: null, height: null };
  }

  const record = value as Record<string, unknown>;
  return {
    width: toPositiveNumber(record.width),
    height: toPositiveNumber(record.height),
  };
}

function isAcceptableThumbnail(
  url: string | null,
  width: number | null,
  height: number | null
): boolean {
  if (!url) return false;
  if (width !== null && width < 140) return false;
  if (height !== null && height < 90) return false;
  if (width !== null && height !== null) {
    const ratio = width / height;
    if (ratio < 0.8 || ratio > 2.8) return false;
  }
  return true;
}

function extractImageFromValue(
  baseUrl: string,
  value: unknown
): { url: string | null; width: number | null; height: number | null } {
  if (typeof value === "string") {
    return {
      url: normalizeImageUrl(resolveAbsoluteUrl(baseUrl, value)),
      width: null,
      height: null,
    };
  }

  if (!value || typeof value !== "object") {
    return { url: null, width: null, height: null };
  }

  const record = value as Record<string, unknown>;
  const url = normalizeImageUrl(
    resolveAbsoluteUrl(baseUrl, firstString(record.url, record.href, record.src)) ??
      resolveAbsoluteUrl(baseUrl, firstString(record["media:thumbnail"], record.thumbnail))
  );
  const dimensions = imageDimensionsFromValue(record);

  return {
    url,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function firstImageFromHtml(
  baseUrl: string,
  value: string | null | undefined
): { url: string | null; width: number | null; height: number | null } {
  if (!value) {
    return {
      url: null,
      width: null,
      height: null,
    };
  }
  const match = value.match(
    /<img[^>]+src=["']([^"']+)["'][^>]*?(?:width=["']?(\d+)[^>]*?)?(?:height=["']?(\d+)[^>]*?)?/i
  );
  return {
    url: normalizeImageUrl(resolveAbsoluteUrl(baseUrl, match?.[1] ?? null)),
    width: toPositiveNumber(match?.[2]),
    height: toPositiveNumber(match?.[3]),
  };
}

function imageFromMeta(document: Document, pageUrl: string): string | null {
  return normalizeImageUrl(
    resolveAbsoluteUrl(
      pageUrl,
      document
        .querySelector(
          'meta[property="og:image"], meta[name="twitter:image"], meta[property="og:image:url"]'
        )
        ?.getAttribute("content")
    )
  );
}

function normalizeCaption(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeWhitespace(decodeHtmlEntities(stripHtml(value) ?? value));
  return normalized.length > 0 ? normalized : null;
}

function imageCaptionFromMeta(document: Document): string | null {
  return normalizeCaption(
    document
      .querySelector('meta[property="og:image:alt"], meta[name="twitter:image:alt"]')
      ?.getAttribute("content")
  );
}

function sameImageCandidate(left: string, right: string): boolean {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return `${leftUrl.origin}${leftUrl.pathname}` === `${rightUrl.origin}${rightUrl.pathname}`;
  } catch {
    return left === right;
  }
}

function imageCaptionFromFigure(
  document: Document,
  pageUrl: string,
  imageUrl: string | null
): string | null {
  if (!imageUrl) return null;

  const figures = Array.from(document.querySelectorAll("figure"));
  for (const figure of figures) {
    const image = figure.querySelector("img");
    const source = normalizeImageUrl(resolveAbsoluteUrl(pageUrl, image?.getAttribute("src")));
    if (!source || !sameImageCandidate(source, imageUrl)) continue;

    const caption = normalizeCaption(figure.querySelector("figcaption")?.textContent);
    if (caption) return caption;
  }

  return null;
}

function imageCaptionFromAttributes(
  document: Document,
  pageUrl: string,
  imageUrl: string | null
): string | null {
  if (!imageUrl) return null;

  const images = Array.from(document.querySelectorAll("article img, main img, img"));
  for (const image of images) {
    const source = normalizeImageUrl(resolveAbsoluteUrl(pageUrl, image.getAttribute("src")));
    if (!source || !sameImageCandidate(source, imageUrl)) continue;

    const caption = normalizeCaption(
      image.getAttribute("alt") || image.getAttribute("title") || image.getAttribute("aria-label")
    );
    if (caption) return caption;
  }

  return null;
}

function imageFromArticleContent(document: Document, pageUrl: string): string | null {
  const candidates = Array.from(
    document.querySelectorAll("article img, main img, img")
  ) as HTMLImageElement[];

  for (const candidate of candidates) {
    const src = normalizeImageUrl(resolveAbsoluteUrl(pageUrl, candidate.getAttribute("src")));
    if (!src) continue;
    const width = Number(candidate.getAttribute("width") ?? "0");
    const height = Number(candidate.getAttribute("height") ?? "0");
    if ((width > 0 && width < 120) || (height > 0 && height < 120)) continue;
    return src;
  }

  return null;
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value) || value.includes("<!--");
}

function toReaderContent(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (looksLikeHtml(trimmed)) {
    const sanitizedHtml = sanitizeReaderHtml(trimmed);
    if (!sanitizedHtml) return null;
    const markdown = turndown.turndown(sanitizedHtml);
    const normalized = decodeHtmlEntities(markdown)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return normalized.length > 0 ? normalized : null;
  }

  const normalized = decodeHtmlEntities(trimmed)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function stableItemId(feedId: string, externalId: string, link: string, title: string): string {
  return createHash("sha1").update(`${feedId}|${externalId}|${link}|${title}`).digest("hex");
}

function migrateFeed(feed: Partial<RssFeed>): RssFeed | null {
  if (!feed.id || !feed.name || !feed.url) return null;

  return {
    id: feed.id,
    name: feed.name,
    url: feed.url,
    origin: feed.origin === "integration" ? "integration" : "manual",
    originRef: feed.origin === "integration" ? (feed.originRef ?? feed.id) : null,
    categoryIds: Array.isArray(feed.categoryIds) ? feed.categoryIds.filter(Boolean) : [],
    isEditable: feed.origin === "integration" ? false : (feed.isEditable ?? true),
    isEnabled: feed.isEnabled ?? true,
    addedAt: feed.addedAt ?? now(),
  };
}

function migrateItem(item: Partial<RssItem>): RssItem | null {
  if (!item.id || !item.feedId || !item.title || !item.link || !item.publishedAt) return null;

  return {
    id: item.id,
    feedId: item.feedId,
    title: item.title,
    link: item.link,
    publishedAt: item.publishedAt,
    author: item.author ?? null,
    excerpt: item.excerpt ?? null,
    feedContent: item.feedContent ?? null,
    extractedContent: item.extractedContent ?? null,
    thumbnailUrl: item.thumbnailUrl ?? null,
    heroImageUrl: item.heroImageUrl ?? null,
    heroImageCaption: item.heroImageCaption ?? null,
    read: item.read ?? false,
    saved: item.saved ?? false,
    readLater: item.readLater ?? false,
    boardIds: Array.isArray(item.boardIds) ? item.boardIds.filter(Boolean) : [],
    fetchedAt: item.fetchedAt ?? now(),
  };
}

async function readPluginValue<T>(pluginId: string, key: string): Promise<T | null> {
  const repo = getPluginRepo();
  const value = await repo.get(pluginId, key);
  return value ? (JSON.parse(value) as T) : null;
}

async function writePluginValue<T>(pluginId: string, key: string, value: T): Promise<void> {
  const repo = getPluginRepo();
  await repo.set(pluginId, key, JSON.stringify(value));
}

async function loadStoredFeeds(): Promise<RssFeed[]> {
  const raw = await readPluginValue<Partial<RssFeed>[]>(RSS_PLUGIN_ID, DB_KEYS.feeds);
  return (raw ?? []).map(migrateFeed).filter((feed): feed is RssFeed => feed !== null);
}

async function loadStoredItems(): Promise<RssItem[]> {
  const raw = await readPluginValue<Partial<RssItem>[]>(RSS_PLUGIN_ID, DB_KEYS.items);
  return (raw ?? []).map(migrateItem).filter((item): item is RssItem => item !== null);
}

async function loadPluginConfig(): Promise<PluginUserConfig | null> {
  return readPluginValue<PluginUserConfig>(RSS_PLUGIN_ID, "_config");
}

async function loadIntegrationFeedOverrides(): Promise<IntegrationRssFeedOverrides> {
  return (
    (await readPluginValue<IntegrationRssFeedOverrides>(
      SYSTEM_PLUGIN_ID,
      INTEGRATION_RSS_FEEDS_KEY
    )) ?? {}
  );
}

function buildIntegrationFeedMap(): Map<string, { name: string; defaultRssFeedUrl?: string }> {
  const map = new Map<string, { name: string; defaultRssFeedUrl?: string }>();

  for (const descriptor of INTEGRATION_REGISTRY.values()) {
    const existing = map.get(descriptor.auth.id);
    map.set(descriptor.auth.id, {
      name: existing?.name ?? descriptor.auth.name ?? descriptor.name,
      defaultRssFeedUrl: existing?.defaultRssFeedUrl ?? descriptor.defaultRssFeedUrl,
    });
  }

  return map;
}

async function deriveIntegrationFeeds(existingFeeds: RssFeed[]): Promise<RssFeed[]> {
  const overrides = await loadIntegrationFeedOverrides();
  const integrationMeta = buildIntegrationFeedMap();
  const existingByOriginRef = new Map(
    existingFeeds
      .filter((feed) => feed.origin === "integration" && feed.originRef)
      .map((feed) => [feed.originRef as string, feed])
  );

  const feeds: RssFeed[] = [];
  for (const [serviceId, meta] of integrationMeta.entries()) {
    const resolvedUrl = resolveIntegrationRssFeedUrl(serviceId, overrides, meta.defaultRssFeedUrl);
    if (!resolvedUrl) continue;

    const existing = existingByOriginRef.get(serviceId);
    feeds.push({
      id: existing?.id ?? `integration:${serviceId}`,
      name: existing?.name ?? meta.name ?? serviceId,
      url: resolvedUrl,
      origin: "integration",
      originRef: serviceId,
      categoryIds: existing?.categoryIds ?? [],
      isEditable: false,
      isEnabled: existing?.isEnabled ?? true,
      addedAt: existing?.addedAt ?? now(),
    });
  }

  return feeds;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
    },
    signal: AbortSignal.timeout(RSS_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function parseRssItems(feedId: string, channel: Record<string, unknown>): ParsedFeed {
  const items = ensureArray(channel.item).map((item) => {
    const entry = item as Record<string, unknown>;
    const link = firstString(entry.link) ?? "";
    const title = firstString(entry.title) ?? link;
    const externalId = firstString(entry.guid, entry.id, entry.link, entry.title) ?? link ?? title;
    const excerpt = stripHtml(firstRawString(entry.description, entry.summary));
    const content = toReaderContent(
      firstRawString(entry["content:encoded"], entry.content, entry.description)
    );
    const thumbnailCandidate =
      extractImageFromValue(link, entry.enclosure) ??
      extractImageFromValue(link, entry["media:content"]) ??
      extractImageFromValue(link, entry["media:thumbnail"]) ??
      firstImageFromHtml(link, firstRawString(entry["content:encoded"], entry.description));
    const thumbnailUrl = isAcceptableThumbnail(
      thumbnailCandidate?.url ?? null,
      thumbnailCandidate?.width ?? null,
      thumbnailCandidate?.height ?? null
    )
      ? (thumbnailCandidate?.url ?? null)
      : null;

    return {
      externalId,
      title,
      link,
      publishedAt: normalizeDate(
        firstString(entry.pubDate, entry.published, entry.updated, entry["dc:date"])
      ),
      author: firstString(entry.author, entry["dc:creator"]),
      excerpt,
      content,
      thumbnailUrl,
      thumbnailWidth: thumbnailCandidate?.width ?? null,
      thumbnailHeight: thumbnailCandidate?.height ?? null,
    };
  });

  return {
    title: firstString(channel.title),
    items: items
      .filter((item) => item.link && item.title)
      .map((item) => ({
        ...item,
        externalId: item.externalId || item.link || item.title || feedId,
      })),
  };
}

function parseAtomItems(feedId: string, feed: Record<string, unknown>): ParsedFeed {
  const items = ensureArray(feed.entry).map((entryValue) => {
    const entry = entryValue as Record<string, unknown>;
    const link = resolveAtomLink(entry.link) ?? "";
    const title = firstString(entry.title) ?? link;
    const externalId = firstString(entry.id, entry.link, entry.title) ?? link ?? title;
    const excerpt = stripHtml(firstRawString(entry.summary));
    const content = toReaderContent(firstRawString(entry.content, entry.summary));
    const thumbnailCandidate =
      extractImageFromValue(link, entry["media:content"]) ??
      extractImageFromValue(link, entry["media:thumbnail"]) ??
      firstImageFromHtml(link, firstRawString(entry.content, entry.summary));
    const thumbnailUrl = isAcceptableThumbnail(
      thumbnailCandidate?.url ?? null,
      thumbnailCandidate?.width ?? null,
      thumbnailCandidate?.height ?? null
    )
      ? (thumbnailCandidate?.url ?? null)
      : null;

    return {
      externalId,
      title,
      link,
      publishedAt: normalizeDate(firstString(entry.published, entry.updated)),
      author: firstString(
        entry.author,
        (entry.author as Record<string, unknown> | undefined)?.name
      ),
      excerpt,
      content,
      thumbnailUrl,
      thumbnailWidth: thumbnailCandidate?.width ?? null,
      thumbnailHeight: thumbnailCandidate?.height ?? null,
    };
  });

  return {
    title: firstString(feed.title),
    items: items
      .filter((item) => item.link && item.title)
      .map((item) => ({
        ...item,
        externalId: item.externalId || item.link || item.title || feedId,
      })),
  };
}

function parseFeedDocument(feedId: string, xml: string): ParsedFeed {
  const parsed = xmlParser.parse(xml) as Record<string, unknown>;

  if (parsed.rss && typeof parsed.rss === "object") {
    return parseRssItems(
      feedId,
      (parsed.rss as Record<string, unknown>).channel as Record<string, unknown>
    );
  }

  if (parsed.feed && typeof parsed.feed === "object") {
    return parseAtomItems(feedId, parsed.feed as Record<string, unknown>);
  }

  if (parsed["rdf:RDF"] && typeof parsed["rdf:RDF"] === "object") {
    return parseRssItems(feedId, parsed["rdf:RDF"] as Record<string, unknown>);
  }

  return { title: null, items: [] };
}

function mergeFeedItems(
  feed: RssFeed,
  parsedFeed: ParsedFeed,
  existingItems: Map<string, RssItem>
): RssItem[] {
  return parsedFeed.items.slice(0, MAX_ITEMS_PER_FEED).map((item) => {
    const id = stableItemId(feed.id, item.externalId, item.link, item.title);
    const existing = existingItems.get(id);

    return {
      id,
      feedId: feed.id,
      title: item.title,
      link: item.link,
      publishedAt: item.publishedAt,
      author: item.author,
      excerpt: item.excerpt,
      feedContent: item.content,
      extractedContent: existing?.extractedContent ?? null,
      thumbnailUrl: existing?.thumbnailUrl ?? item.thumbnailUrl,
      heroImageUrl: existing?.heroImageUrl ?? item.thumbnailUrl,
      heroImageCaption: existing?.heroImageCaption ?? null,
      read: existing?.read ?? false,
      saved: existing?.saved ?? false,
      readLater: existing?.readLater ?? false,
      boardIds: existing?.boardIds ?? [],
      fetchedAt: now(),
    };
  });
}

function shouldEmitNotifications(config: PluginUserConfig | null): boolean {
  return config?.notificationIntegrationEnabled ?? true;
}

export async function syncRssFeeds(options?: { emitNotifications?: boolean }) {
  const existingFeeds = await loadStoredFeeds();
  const manualFeeds = existingFeeds.filter((feed) => feed.origin !== "integration");
  const integrationFeeds = await deriveIntegrationFeeds(existingFeeds);
  const feeds = [...manualFeeds, ...integrationFeeds];
  const existingItemsList = await loadStoredItems();
  const existingItems = new Map(existingItemsList.map((item) => [item.id, item]));

  const syncedResults = await Promise.allSettled(
    feeds
      .filter((feed) => feed.isEnabled && !isCircuitOpen(feed.url))
      .map(async (feed) => {
        try {
          const xml = await fetchText(feed.url);
          const parsedFeed = parseFeedDocument(feed.id, xml);
          recordSuccess(feed.url);
          return {
            feed,
            nextFeedName: parsedFeed.title,
            items: mergeFeedItems(feed, parsedFeed, existingItems),
          };
        } catch (error) {
          recordFailure(feed.url);
          throw error;
        }
      })
  );

  const updatedFeeds = feeds.map((feed) => {
    const synced = syncedResults.find(
      (
        result
      ): result is PromiseFulfilledResult<{
        feed: RssFeed;
        nextFeedName: string | null;
        items: RssItem[];
      }> => result.status === "fulfilled" && result.value.feed.id === feed.id
    );
    if (!synced || !synced.value.nextFeedName || feed.origin === "manual") return feed;
    return { ...feed, name: synced.value.nextFeedName };
  });

  const nextItemsMap = new Map<string, RssItem>();
  const validFeedIds = new Set(updatedFeeds.map((feed) => feed.id));
  for (const item of existingItemsList) {
    if (!validFeedIds.has(item.feedId)) continue;
    nextItemsMap.set(item.id, item);
  }

  for (const result of syncedResults) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value.items) {
      nextItemsMap.set(item.id, item);
    }
  }

  const nextItems = [...nextItemsMap.values()].sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt)
  );

  await Promise.all([
    writePluginValue(RSS_PLUGIN_ID, DB_KEYS.feeds, updatedFeeds),
    writePluginValue(RSS_PLUGIN_ID, DB_KEYS.items, nextItems),
  ]);

  if (options?.emitNotifications) {
    const config = await loadPluginConfig();
    if (shouldEmitNotifications(config)) {
      const previousIds = new Set(existingItemsList.map((item) => item.id));
      const feedsById = new Map(updatedFeeds.map((feed) => [feed.id, feed]));

      await Promise.allSettled(
        nextItems
          .filter((item) => !previousIds.has(item.id))
          .map(async (item) => {
            const feed = feedsById.get(item.feedId);
            await emitNotificationEvent({
              source: `plugin:${RSS_PLUGIN_ID}`,
              type: "rss.item.new",
              severity: "info",
              title: item.title,
              body: feed ? `New item from ${feed.name}` : null,
              metadata: {
                feedId: item.feedId,
                feedName: feed?.name ?? null,
                link: item.link,
              },
            });
          })
      );
    }
  }

  return {
    feeds: updatedFeeds,
    items: nextItems,
    syncedFeedCount: syncedResults.filter((result) => result.status === "fulfilled").length,
  };
}

export async function extractArticleContent(url: string): Promise<{
  content: string | null;
  heroImageUrl: string | null;
  heroImageCaption: string | null;
}> {
  const html = await fetchText(url);
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const result = reader.parse();
  const content = toReaderContent(result?.content ?? null);
  const heroImageUrl =
    imageFromMeta(dom.window.document, url) ?? imageFromArticleContent(dom.window.document, url);
  const heroImageCaption =
    imageCaptionFromFigure(dom.window.document, url, heroImageUrl) ??
    imageCaptionFromMeta(dom.window.document) ??
    imageCaptionFromAttributes(dom.window.document, url, heroImageUrl);

  return {
    content: content && content.length >= 200 ? content : null,
    heroImageUrl: heroImageUrl ?? null,
    heroImageCaption: heroImageCaption ?? null,
  };
}
