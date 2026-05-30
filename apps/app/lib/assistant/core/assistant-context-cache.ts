/**
 * Assistant context cache — caches expensive, mostly-static parts of
 * the chat route context to avoid rebuilding them on every request.
 *
 * Cached items:
 * - AI tools (depends on connected credential keys)
 * - Action tools (static)
 * - MCP tools (depends on configured MCP servers)
 * - Plugin tools (depends on installed plugins)
 * - Skills (depends on skill overrides)
 *
 * Cache is invalidated after TTL or when the credential key set changes.
 */

const CACHE_TTL_MS = 60_000; // 1 minute

interface CachedContext {
  // biome-ignore lint/suspicious/noExplicitAny: tool types vary
  aiTools: Record<string, any>;
  // biome-ignore lint/suspicious/noExplicitAny: tool types vary
  actionTools: Record<string, any>;
  // biome-ignore lint/suspicious/noExplicitAny: tool types vary
  mcpTools: Record<string, any>;
  // biome-ignore lint/suspicious/noExplicitAny: tool types vary
  pluginTools: Record<string, any>;
  pluginToolNames: string[];
  browserToolsAvailable: boolean;
  connectedKeysHash: string;
  cachedAt: number;
}

const GLOBAL_KEY = "__radarboard_assistant_context_cache__" as const;

function getCache(): CachedContext | null {
  const g = globalThis as unknown as Record<string, CachedContext | undefined>;
  return g[GLOBAL_KEY] ?? null;
}

function setCache(ctx: CachedContext): void {
  (globalThis as unknown as Record<string, CachedContext>)[GLOBAL_KEY] = ctx;
}

function hashKeys(keys: string[]): string {
  return keys.sort().join(",");
}

/**
 * Get cached assistant tools or null if cache is stale/missing.
 */
export function getCachedAssistantContext(connectedKeys: string[]): CachedContext | null {
  const cached = getCache();
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > CACHE_TTL_MS) return null;
  if (cached.connectedKeysHash !== hashKeys(connectedKeys)) return null;
  return cached;
}

/**
 * Store assistant tools in cache.
 */
export function setCachedAssistantContext(
  connectedKeys: string[],
  context: Omit<CachedContext, "connectedKeysHash" | "cachedAt">
): CachedContext {
  const cached: CachedContext = {
    ...context,
    connectedKeysHash: hashKeys(connectedKeys),
    cachedAt: Date.now(),
  };
  setCache(cached);
  return cached;
}

/** Invalidate the cache (e.g., after settings change). */
export function invalidateAssistantContextCache(): void {
  const g = globalThis as unknown as Record<string, undefined>;
  g[GLOBAL_KEY] = undefined;
}
