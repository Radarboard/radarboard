/**
 * Discord API client for the Radarboard dashboard.
 *
 * Uses the Discord REST API at https://discord.com/api/v10
 * Authenticated via Bot token (Bearer).
 *
 * @see https://discord.com/developers/docs/reference
 */

import type { DiscordConfig, DiscordGuildOverview, DiscordMessage } from "../types";

const BASE_URL = "https://discord.com/api/v10";

// --- Cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// --- Error ---

export class DiscordAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "DiscordAPIError";
  }
}

// --- Fetcher ---

async function fetchDiscord<T>(
  config: DiscordConfig,
  path: string,
  params?: Record<string, string>,
  cacheKey?: string
): Promise<T> {
  const key = cacheKey ?? `discord:${path}:${JSON.stringify(params)}`;
  const cached = getCached<T>(key);
  if (cached) return cached;

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bot ${config.botToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new DiscordAPIError(
      response.status,
      `Discord API error ${response.status}: ${errorBody.slice(0, 200)}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(key, data);
  return data;
}

// --- Discord API response types ---

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  premium_tier: number;
}

interface DiscordChannel {
  id: string;
  type: number;
  name?: string;
}

interface DiscordRawMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
  };
  channel_id: string;
  timestamp: string;
  edited_timestamp: string | null;
}

// --- Public API ---

/**
 * Get guild (server) overview: member count, online count, channel count, boost level.
 */
export async function getGuildOverview(config: DiscordConfig): Promise<DiscordGuildOverview> {
  const guild = await fetchDiscord<DiscordGuild>(
    config,
    `/guilds/${config.guildId}`,
    { with_counts: "true" },
    `discord:guild:${config.guildId}`
  );

  const channels = await fetchDiscord<DiscordChannel[]>(
    config,
    `/guilds/${config.guildId}/channels`,
    undefined,
    `discord:channels:${config.guildId}`
  );

  const iconUrl = guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
    : null;

  return {
    memberCount: guild.approximate_member_count ?? 0,
    onlineCount: guild.approximate_presence_count ?? 0,
    channelCount: channels.length,
    boostLevel: guild.premium_tier,
    name: guild.name,
    iconUrl,
  };
}

/**
 * Get recent messages from a specified channel.
 */
export async function getRecentMessages(
  config: DiscordConfig,
  channelId: string,
  limit = 20
): Promise<DiscordMessage[]> {
  const messages = await fetchDiscord<DiscordRawMessage[]>(
    config,
    `/channels/${channelId}/messages`,
    { limit: limit.toString() }
  );

  return messages.map((m) => ({
    id: m.id,
    content: m.content,
    author: {
      id: m.author.id,
      username: m.author.username,
      discriminator: m.author.discriminator,
    },
    channelId: m.channel_id,
    timestamp: m.timestamp,
    editedTimestamp: m.edited_timestamp,
  }));
}
