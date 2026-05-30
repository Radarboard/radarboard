import { afterEach, describe, expect, it, vi } from "vitest";
import { getGuildOverview, getRecentMessages } from "./client";

describe("discord client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("builds the guild overview from guild and channel responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "guild-1",
          name: "Radarboard HQ",
          icon: "icon-123",
          approximate_member_count: 128,
          approximate_presence_count: 24,
          premium_tier: 2,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "c-1" }, { id: "c-2" }, { id: "c-3" }],
      });
    vi.stubGlobal("fetch", fetchMock);

    const overview = await getGuildOverview({ botToken: "bot-token", guildId: "guild-1" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(overview).toEqual({
      memberCount: 128,
      onlineCount: 24,
      channelCount: 3,
      boostLevel: 2,
      name: "Radarboard HQ",
      iconUrl: "https://cdn.discordapp.com/icons/guild-1/icon-123.png",
    });
  });

  it("maps recent messages and marks 429s as retryable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "m-1",
            content: "Ship it",
            author: { id: "u-1", username: "david", discriminator: "0001" },
            channel_id: "general",
            timestamp: "2026-03-20T10:00:00.000Z",
            edited_timestamp: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "rate limited",
      });
    vi.stubGlobal("fetch", fetchMock);

    const messages = await getRecentMessages(
      { botToken: "bot-token", guildId: "guild-1" },
      "general"
    );

    expect(messages).toEqual([
      {
        id: "m-1",
        content: "Ship it",
        author: { id: "u-1", username: "david", discriminator: "0001" },
        channelId: "general",
        timestamp: "2026-03-20T10:00:00.000Z",
        editedTimestamp: null,
      },
    ]);

    await expect(
      getRecentMessages({ botToken: "bot-token", guildId: "guild-1" }, "general", 5)
    ).rejects.toMatchObject({
      status: 429,
      retryable: true,
    });
  });

  it("re-fetches after cache expiry and handles non-retryable errors", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T00:00:00.000Z"));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "guild-1",
          name: "First",
          icon: null,
          premium_tier: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "guild-1",
          name: "Second",
          icon: null,
          premium_tier: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "bad request",
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getGuildOverview({ botToken: "bot-token", guildId: "guild-2" })
    ).resolves.toMatchObject({
      name: "First",
      iconUrl: null,
    });
    await expect(
      getGuildOverview({ botToken: "bot-token", guildId: "guild-2" })
    ).resolves.toMatchObject({
      name: "First",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    await expect(
      getGuildOverview({ botToken: "bot-token", guildId: "guild-2" })
    ).resolves.toMatchObject({
      name: "Second",
      iconUrl: null,
    });
    await expect(
      getRecentMessages({ botToken: "bot-token", guildId: "guild-2" }, "general", 7)
    ).rejects.toMatchObject({
      status: 400,
      retryable: false,
    });
  });
});
