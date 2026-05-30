/**
 * Discord — Data Sources
 */

import type { DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import type { DiscordConfig } from "../types";
import { getGuildOverview, getRecentMessages } from "./client";

async function resolveConfig(ctx: {
  resolveCredential(key: string): Promise<Record<string, string> | null>;
}): Promise<DiscordConfig | null> {
  const creds = await ctx.resolveCredential("discord");
  if (!creds?.botToken || !creds?.guildId) return null;
  return { botToken: creds.botToken, guildId: creds.guildId };
}

export const discordGuildOverviewDataSource: DataSourceDescriptor = {
  action: "data",
  description:
    "Server overview: member count, online count, channel count, boost level from Discord.",
  cacheTtlSeconds: 300,
  async fetch(_params, ctx) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false };
    return getGuildOverview(config);
  },
};

export const discordMessagesDataSource: DataSourceDescriptor = {
  action: "messages",
  description: "Recent messages from a specified Discord channel.",
  cacheTtlSeconds: 120,
  async fetch(params, ctx) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false };
    const channelId = (params as Record<string, unknown>).channelId as string | undefined;
    if (!channelId) return { error: "channelId is required" };
    return getRecentMessages(config, channelId);
  },
};

export const discordDataSources = [discordGuildOverviewDataSource, discordMessagesDataSource];
