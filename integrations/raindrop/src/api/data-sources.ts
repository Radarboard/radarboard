import type { DataSourceDescriptor, TimeRange } from "@radarboard/integration-sdk/types";
import type {
  RaindropBookmark,
  RaindropCollection,
  RaindropResponse,
  RaindropTag,
} from "@radarboard/types/raindrop";
import { getTimeRangeWindow } from "@radarboard/utils/timezone";
import type {
  RaindropBookmarkDataSummary,
  RaindropConfig,
  RaindropDataPayload,
  RawRaindropCollection,
  RawRaindropItem,
} from "../types";
import { getCollections, getRecentRaindrops, getTags, RaindropAPIError } from "./client";

const RECENT_LIMIT = 25;
const PAGE_SIZE = 100;
const TOP_TAG_LIMIT = 8;

function buildCollectionUrl(collectionId: number | null): string | null {
  if (collectionId == null) return null;
  return `https://app.raindrop.io/my/${collectionId}`;
}

function buildBookmarkUrl(bookmarkId: number): string {
  return `https://app.raindrop.io/my/0/item/${bookmarkId}`;
}

function inferDomain(link: string): string {
  try {
    return new URL(link).hostname;
  } catch {
    return "";
  }
}

function inferCoverUrl(item: RawRaindropItem): string | null {
  if (typeof item.cover === "string" && item.cover.length > 0) return item.cover;
  const mediaUrl = item.media?.find((entry) => typeof entry.link === "string" && entry.link)?.link;
  return mediaUrl ?? null;
}

function buildSummary(input: {
  savedCount: number;
  totalCollections: number;
  totalTags: number;
  recentCount: number;
}): RaindropBookmarkDataSummary {
  return {
    savedCount: input.savedCount,
    totalCollections: input.totalCollections,
    totalTags: input.totalTags,
    recentCount: input.recentCount,
  };
}

function normalizeCollectionTitle(
  collectionId: number | null,
  collectionMap: Map<number, string>
): string {
  if (collectionId === -1) return "Unsorted";
  if (collectionId === -99) return "Trash";
  if (collectionId == null) return "Unknown";
  return collectionMap.get(collectionId) ?? `Collection ${collectionId}`;
}

function normalizeCollections(rawCollections: RawRaindropCollection[]): RaindropCollection[] {
  return rawCollections
    .map((collection) => ({
      id: collection._id,
      title: collection.title,
      count: collection.count ?? 0,
      color: collection.color ?? null,
      parentId: collection.parent?.$id ?? null,
      lastUpdate: collection.lastUpdate ?? "",
      collectionUrl: buildCollectionUrl(collection._id) ?? "",
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.title.localeCompare(right.title);
    });
}

function normalizeRecent(
  rawItems: RawRaindropItem[],
  collectionMap: Map<number, string>
): RaindropBookmark[] {
  return rawItems
    .map((item) => {
      const collectionId = item.collection?.$id ?? null;
      return {
        id: item._id,
        title: item.title?.trim() || item.link,
        excerpt: item.excerpt?.trim() ?? "",
        link: item.link,
        domain: item.domain?.trim() || inferDomain(item.link),
        created: item.created ?? item.lastUpdate ?? new Date(0).toISOString(),
        lastUpdate: item.lastUpdate ?? item.created ?? new Date(0).toISOString(),
        tags: Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === "string") : [],
        important: item.important === true,
        collectionId,
        collectionTitle: normalizeCollectionTitle(collectionId, collectionMap),
        collectionUrl: buildCollectionUrl(collectionId),
        raindropUrl: buildBookmarkUrl(item._id),
        coverUrl: inferCoverUrl(item),
      };
    })
    .filter((bookmark) => bookmark.link.length > 0)
    .sort((left, right) => right.created.localeCompare(left.created));
}

function normalizeTopTags(rawTags: Array<{ _id: string; count: number }>): RaindropTag[] {
  return rawTags
    .map((tag) => ({
      name: tag._id,
      count: tag.count ?? 0,
    }))
    .filter((tag) => tag.name.length > 0)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.name.localeCompare(right.name);
    })
    .slice(0, TOP_TAG_LIMIT);
}

function countSavedBookmarks(collections: RaindropCollection[]): number {
  return collections.reduce((sum, collection) => sum + collection.count, 0);
}

function buildScopedTopTags(bookmarks: RaindropBookmark[]): {
  topTags: RaindropTag[];
  totalTags: number;
} {
  const tagCounts = new Map<string, number>();

  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topTags = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.name.localeCompare(right.name);
    })
    .slice(0, TOP_TAG_LIMIT);

  return {
    topTags,
    totalTags: tagCounts.size,
  };
}

function buildScopedCollections(
  bookmarks: RaindropBookmark[],
  collectionMetaById: Map<number, RaindropCollection>
): RaindropCollection[] {
  const collectionCounts = new Map<number, RaindropCollection>();

  for (const bookmark of bookmarks) {
    if (bookmark.collectionId == null) continue;

    const existing = collectionCounts.get(bookmark.collectionId);
    const meta = collectionMetaById.get(bookmark.collectionId);
    const lastUpdateCandidate = bookmark.lastUpdate || bookmark.created;

    if (existing) {
      existing.count += 1;
      if (lastUpdateCandidate.localeCompare(existing.lastUpdate) > 0) {
        existing.lastUpdate = lastUpdateCandidate;
      }
      continue;
    }

    collectionCounts.set(bookmark.collectionId, {
      id: bookmark.collectionId,
      title: meta?.title ?? bookmark.collectionTitle,
      count: 1,
      color: meta?.color ?? null,
      parentId: meta?.parentId ?? null,
      lastUpdate: lastUpdateCandidate,
      collectionUrl:
        meta?.collectionUrl ??
        bookmark.collectionUrl ??
        buildCollectionUrl(bookmark.collectionId) ??
        "",
    });
  }

  return Array.from(collectionCounts.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.title.localeCompare(right.title);
  });
}

function buildScopedPayload(
  source: "api" | "mcp",
  bookmarks: RaindropBookmark[],
  collectionMetaById: Map<number, RaindropCollection>
): RaindropDataPayload {
  const recent = bookmarks.slice(0, RECENT_LIMIT);
  const collections = buildScopedCollections(bookmarks, collectionMetaById);
  const { topTags, totalTags } = buildScopedTopTags(bookmarks);
  const collectionKeys = new Set(
    bookmarks.map((bookmark) =>
      bookmark.collectionId != null
        ? `id:${bookmark.collectionId}`
        : `title:${bookmark.collectionTitle || "unknown"}`
    )
  );

  return {
    configured: true,
    summary: buildSummary({
      savedCount: bookmarks.length,
      totalCollections: collectionKeys.size,
      totalTags,
      recentCount: recent.length,
    }),
    recent,
    collections,
    topTags,
    source,
  };
}

function emptyPayload(source: "api" | "mcp", error?: string): RaindropDataPayload {
  return {
    configured: false,
    summary: {
      savedCount: 0,
      totalCollections: 0,
      totalTags: 0,
      recentCount: 0,
    },
    recent: [],
    collections: [],
    topTags: [],
    source,
    ...(error ? { error } : {}),
  };
}

function getToolProps(tool: {
  inputSchema?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const schema = tool.inputSchema ?? {};
  const properties = schema.properties;
  return properties && typeof properties === "object"
    ? (properties as Record<string, unknown>)
    : {};
}

function setFirstSupportedArg(
  args: Record<string, unknown>,
  props: Record<string, unknown>,
  keys: string[],
  value: unknown
): void {
  if (value === undefined || value === null) return;
  for (const key of keys) {
    if (key in props) {
      args[key] = value;
      return;
    }
  }
}

function buildBookmarkSearchArgs(
  tool: { inputSchema?: Record<string, unknown> | null },
  limit: number,
  page?: number
): Record<string, unknown> {
  const props = getToolProps(tool);
  const args: Record<string, unknown> = {};
  setFirstSupportedArg(args, props, ["query", "search", "term"], "");
  setFirstSupportedArg(args, props, ["limit", "perpage", "perPage", "count"], limit);
  setFirstSupportedArg(args, props, ["page"], page);
  setFirstSupportedArg(args, props, ["collectionId", "collection_id"], 0);
  setFirstSupportedArg(args, props, ["sort"], "-created");
  setFirstSupportedArg(args, props, ["nested"], true);
  return args;
}

function buildCollectionListArgs(tool: {
  inputSchema?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const props = getToolProps(tool);
  const args: Record<string, unknown> = {};
  setFirstSupportedArg(args, props, ["collectionId", "collection_id"], 0);
  return args;
}

function resolveMcpItems<T>(raw: unknown, candidates: string[]): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  for (const candidate of candidates) {
    const value = record[candidate];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeMcpCollection(raw: unknown): RawRaindropCollection | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = readNumber(value._id) ?? readNumber(value.id);
  const title = readString(value.title) ?? readString(value.name);
  if (id == null || !title) return null;
  return {
    _id: id,
    title,
    count:
      readNumber(value.count) ??
      readNumber(value.itemsCount) ??
      readNumber(value.bookmarksCount) ??
      0,
    color: readString(value.color) ?? undefined,
    lastUpdate:
      readString(value.lastUpdate) ??
      readString(value.updatedAt) ??
      readString(value.updated_at) ??
      undefined,
    parent: {
      $id:
        readNumber((value.parent as Record<string, unknown> | null)?.$id) ??
        readNumber(value.parentId) ??
        undefined,
    },
  };
}

function readCollectionId(value: Record<string, unknown>): number | undefined {
  const col = value.collection as Record<string, unknown> | null;
  const id = readNumber(col?.$id) ?? readNumber(col?.id) ?? readNumber(value.collectionId);
  return id ?? undefined;
}

function readTags(value: Record<string, unknown>): string[] | undefined {
  return Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;
}

function normalizeMcpBookmark(raw: unknown): RawRaindropItem | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = readNumber(value._id) ?? readNumber(value.id);
  const link = readString(value.link) ?? readString(value.url);
  if (id == null || !link) return null;
  const collectionId = readCollectionId(value);

  return {
    _id: id,
    title: readString(value.title) ?? undefined,
    excerpt: readString(value.excerpt) ?? readString(value.description) ?? undefined,
    link,
    domain: readString(value.domain) ?? undefined,
    created: readString(value.created) ?? readString(value.createdAt) ?? undefined,
    lastUpdate: readString(value.lastUpdate) ?? readString(value.updatedAt) ?? undefined,
    tags: readTags(value),
    important: Boolean(value.important) || Boolean(value.favorite),
    collection: collectionId != null ? { $id: collectionId } : undefined,
    cover: readString(value.cover) ?? readString(value.coverUrl) ?? undefined,
  };
}

async function fetchMcpPaged(
  callMcpToolJsonByName: (
    name: string,
    tool: string,
    args: Record<string, unknown>
  ) => Promise<unknown>,
  bookmarkTool: { name: string; inputSchema?: Record<string, unknown> | null },
  range: TimeRange,
  timeZone: string,
  collectionMap: Map<number, string>
): Promise<RaindropBookmark[]> {
  const bookmarkProps = getToolProps(bookmarkTool);
  const supportsPaging = Object.hasOwn(bookmarkProps, "page");
  const { start } = getTimeRangeWindow(range, timeZone);
  const bookmarks: RaindropBookmark[] = [];

  for (let page = 0; ; page += 1) {
    const rawBookmarksResult = await callMcpToolJsonByName(
      "raindrop",
      bookmarkTool.name,
      buildBookmarkSearchArgs(bookmarkTool, PAGE_SIZE, page)
    );
    const rawBookmarks = resolveMcpItems<unknown>(rawBookmarksResult, [
      "items",
      "bookmarks",
      "raindrops",
    ])
      .map(normalizeMcpBookmark)
      .filter((bookmark): bookmark is RawRaindropItem => bookmark != null);
    const normalized = normalizeRecent(rawBookmarks, collectionMap);

    if (normalized.length === 0) break;

    let reachedRangeBoundary = false;

    for (const bookmark of normalized) {
      if (Date.parse(bookmark.created) < start.getTime()) {
        reachedRangeBoundary = true;
        continue;
      }
      bookmarks.push(bookmark);
    }

    if (!supportsPaging || normalized.length < PAGE_SIZE || reachedRangeBoundary) {
      break;
    }
  }
  return bookmarks;
}

type McpCtx = {
  listMcpToolsByName?: (
    name: string
  ) => Promise<Array<{ name: string; inputSchema?: Record<string, unknown> | null }>>;
  callMcpToolJsonByName?: <T>(
    name: string,
    tool: string,
    args: Record<string, unknown>
  ) => Promise<T>;
};

async function discoverMcpTools(ctx: McpCtx) {
  if (!ctx.listMcpToolsByName || !ctx.callMcpToolJsonByName) return null;

  const toolResult = await ctx
    .listMcpToolsByName("raindrop")
    .then((tools) => ({ tools, error: null as string | null }))
    .catch((error) => ({
      tools: [] as Array<{ name: string; inputSchema?: Record<string, unknown> | null }>,
      error: error instanceof Error ? error.message : String(error),
    }));

  if (toolResult.error) return { error: toolResult.error };
  if (toolResult.tools.length === 0) return null;

  const bookmarkTool = toolResult.tools.find((t) =>
    ["bookmark_search", "listRaindrops"].includes(t.name)
  );
  const collectionTool = toolResult.tools.find((t) =>
    ["collection_list", "listCollections"].includes(t.name)
  );

  if (!bookmarkTool || !collectionTool) {
    return { error: "Raindrop MCP server does not expose supported read tools" };
  }

  return { bookmarkTool, collectionTool, callMcpToolJsonByName: ctx.callMcpToolJsonByName };
}

async function fetchMcpCollections(
  callMcpToolJsonByName: NonNullable<McpCtx["callMcpToolJsonByName"]>,
  collectionTool: { name: string; inputSchema?: Record<string, unknown> | null }
) {
  const rawCollectionsResult = await callMcpToolJsonByName<unknown>(
    "raindrop",
    collectionTool.name,
    buildCollectionListArgs(collectionTool)
  );
  const rawCollections = resolveMcpItems<unknown>(rawCollectionsResult, ["items", "collections"])
    .map(normalizeMcpCollection)
    .filter((collection): collection is RawRaindropCollection => collection != null);
  const collections = normalizeCollections(rawCollections);
  const collectionMap = new Map(collections.map((c) => [c.id, c.title]));
  const collectionMetaById = new Map(collections.map((c) => [c.id, c]));
  return { collections, collectionMap, collectionMetaById };
}

async function _fetchViaMcp(
  ctx: McpCtx,
  params: { range: TimeRange; timeZone: string }
): Promise<RaindropDataPayload> {
  const discovered = await discoverMcpTools(ctx);
  if (!discovered) return emptyPayload("mcp");
  if ("error" in discovered) return emptyPayload("mcp", discovered.error);

  const { bookmarkTool, collectionTool, callMcpToolJsonByName } = discovered;
  const { collections, collectionMap, collectionMetaById } = await fetchMcpCollections(
    callMcpToolJsonByName,
    collectionTool
  );

  if (params.range !== "all") {
    const bookmarks = await fetchMcpPaged(
      callMcpToolJsonByName,
      bookmarkTool,
      params.range,
      params.timeZone,
      collectionMap
    );
    return buildScopedPayload("mcp", bookmarks, collectionMetaById);
  }

  const rawBookmarksResult = await callMcpToolJsonByName<unknown>(
    "raindrop",
    bookmarkTool.name,
    buildBookmarkSearchArgs(bookmarkTool, RECENT_LIMIT)
  );
  const rawBookmarks = resolveMcpItems<unknown>(rawBookmarksResult, [
    "items",
    "bookmarks",
    "raindrops",
  ])
    .map(normalizeMcpBookmark)
    .filter((bookmark): bookmark is RawRaindropItem => bookmark != null);
  const recent = normalizeRecent(rawBookmarks, collectionMap).slice(0, RECENT_LIMIT);
  const { topTags, totalTags } = buildScopedTopTags(recent);

  return {
    configured: true,
    summary: buildSummary({
      savedCount: countSavedBookmarks(collections),
      totalCollections: collections.length,
      totalTags,
      recentCount: recent.length,
    }),
    recent,
    collections,
    topTags,
    source: "mcp",
  };
}

async function fetchApiPaged(
  config: RaindropConfig,
  range: TimeRange,
  timeZone: string,
  collectionMap: Map<number, string>
): Promise<RaindropBookmark[]> {
  const { start } = getTimeRangeWindow(range, timeZone);
  const bookmarks: RaindropBookmark[] = [];

  for (let page = 0; ; page += 1) {
    const rawRecent = await getRecentRaindrops(config, {
      page,
      perpage: PAGE_SIZE,
    });
    const normalized = normalizeRecent(rawRecent.items, collectionMap);

    if (normalized.length === 0) break;

    let reachedRangeBoundary = false;

    for (const bookmark of normalized) {
      if (Date.parse(bookmark.created) < start.getTime()) {
        reachedRangeBoundary = true;
        continue;
      }
      bookmarks.push(bookmark);
    }

    if (normalized.length < PAGE_SIZE || reachedRangeBoundary) {
      break;
    }
  }
  return bookmarks;
}

async function fetchViaApi(
  config: RaindropConfig,
  params: { range: TimeRange; timeZone: string }
): Promise<RaindropDataPayload> {
  const rawCollections = await getCollections(config);
  const collections = normalizeCollections(rawCollections.items);
  const collectionMap = new Map(collections.map((collection) => [collection.id, collection.title]));
  const collectionMetaById = new Map(collections.map((collection) => [collection.id, collection]));

  if (params.range !== "all") {
    const bookmarks = await fetchApiPaged(config, params.range, params.timeZone, collectionMap);
    return buildScopedPayload("api", bookmarks, collectionMetaById);
  }

  const [rawRecent, rawTags] = await Promise.all([
    getRecentRaindrops(config, { perpage: RECENT_LIMIT }),
    getTags(config, 0),
  ]);
  const recent = normalizeRecent(rawRecent.items, collectionMap).slice(0, RECENT_LIMIT);
  const topTags = normalizeTopTags(rawTags.items);

  return {
    configured: true,
    summary: buildSummary({
      savedCount: countSavedBookmarks(collections),
      totalCollections: collections.length,
      totalTags: rawTags.items.length,
      recentCount: recent.length,
    }),
    recent,
    collections,
    topTags,
    source: "api",
  };
}

export const raindropDataSource: DataSourceDescriptor = {
  action: "data",
  description: "Returns recent Raindrop bookmarks, collections, and top tags.",
  cacheTtlSeconds: 300,
  pollingSourceId: "raindrop",
  evictPrefixes: ["raindrop:"],
  buildCacheKey: ({ range, timeZone }) => `raindrop:all:${range}:${timeZone}`,
  async fetch(params, ctx): Promise<RaindropResponse> {
    const saved = await ctx.resolveCredential("raindrop");
    const config = saved?.accessToken ? { accessToken: saved.accessToken } : null;

    if (config) {
      try {
        return await fetchViaApi(config, params);
      } catch (error) {
        if (error instanceof RaindropAPIError && error.status === 401) {
          return emptyPayload("api", "Invalid Raindrop access token");
        }
        throw error;
      }
    }

    return emptyPayload("api", "Raindrop API credentials are required for dashboard access");
  },
};

export const raindropDataSources: DataSourceDescriptor[] = [raindropDataSource];
