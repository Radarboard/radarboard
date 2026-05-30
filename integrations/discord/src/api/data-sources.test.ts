import type { CommonRouteParams, DataSourceContext } from "@radarboard/integration-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const getGuildOverview = vi.fn();
const getRecentMessages = vi.fn();

vi.mock("./client", () => ({
  getGuildOverview: (...args: unknown[]) => getGuildOverview(...args),
  getRecentMessages: (...args: unknown[]) => getRecentMessages(...args),
}));

import { discordGuildOverviewDataSource, discordMessagesDataSource } from "./data-sources";

const stubParams: Record<string, unknown> & CommonRouteParams = {
  projectSlug: null,
  range: "30d",
  timeZone: "UTC",
  forceRefresh: false,
};

function stubCtx(resolveValue: Record<string, string> | null): DataSourceContext {
  return {
    resolveCredential: vi.fn().mockResolvedValue(resolveValue),
    getProjectIntegrations: vi.fn().mockResolvedValue({}),
    getAllProjects: vi.fn().mockResolvedValue([]),
  };
}

describe("discord data sources", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getGuildOverview.mockReset();
    getRecentMessages.mockReset();
  });

  it("returns configured false when guild credentials are missing", async () => {
    const result = await discordGuildOverviewDataSource.fetch(stubParams, stubCtx(null));

    expect(result).toEqual({ configured: false });
  });

  it("requires a channel id for the messages source", async () => {
    const result = await discordMessagesDataSource.fetch(
      stubParams,
      stubCtx({ botToken: "bot", guildId: "guild" })
    );

    expect(result).toEqual({ error: "channelId is required" });
    expect(getRecentMessages).not.toHaveBeenCalled();
  });

  it("returns configured false for the messages source when credentials are incomplete", async () => {
    const result = await discordMessagesDataSource.fetch(
      { ...stubParams, channelId: "general" },
      stubCtx({ botToken: "bot" })
    );

    expect(result).toEqual({ configured: false });
  });

  it("delegates to the client helpers when credentials are present", async () => {
    getGuildOverview.mockResolvedValue({ memberCount: 10 });
    getRecentMessages.mockResolvedValue([{ id: "m-1" }]);
    const ctx = stubCtx({ botToken: "bot", guildId: "guild" });

    await expect(discordGuildOverviewDataSource.fetch(stubParams, ctx)).resolves.toEqual({
      memberCount: 10,
    });
    await expect(
      discordMessagesDataSource.fetch({ ...stubParams, channelId: "general" }, ctx)
    ).resolves.toEqual([{ id: "m-1" }]);

    expect(getGuildOverview).toHaveBeenCalledWith({ botToken: "bot", guildId: "guild" });
    expect(getRecentMessages).toHaveBeenCalledWith(
      { botToken: "bot", guildId: "guild" },
      "general"
    );
  });
});
