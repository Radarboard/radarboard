/**
 * Discord — Data types
 */

export interface DiscordConfig {
  botToken: string;
  guildId: string;
}

export interface DiscordGuildOverview {
  /** Total number of members in the guild. */
  memberCount: number;
  /** Approximate number of members currently online. */
  onlineCount: number;
  /** Total number of channels in the guild. */
  channelCount: number;
  /** Server boost level (0–3). */
  boostLevel: number;
  /** Guild name. */
  name: string;
  /** Guild icon URL, if set. */
  iconUrl: string | null;
}

export interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
  };
  channelId: string;
  timestamp: string;
  editedTimestamp: string | null;
}
