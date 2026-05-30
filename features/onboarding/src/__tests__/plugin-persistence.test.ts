import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { describe, expect, it, vi } from "vitest";
import {
  buildDisabledPluginIds,
  persistEnabledPlugins,
} from "../components/onboarding-wizard/plugin-persistence";
import { INITIAL_ONBOARDING_STATE } from "../components/onboarding-wizard/types";

function plugin(id: string): PluginDescriptor {
  return {
    id,
    name: id,
    description: `${id} plugin`,
    icon: () => null,
    category: "productivity",
    version: "0.1.0",
    launchSurfaces: ["palette"],
    presentation: "side-panel",
    component: () => null,
  };
}

describe("plugin onboarding persistence", () => {
  it("keeps selected and essential plugins enabled while sorting disabled ids", () => {
    const disabledIds = buildDisabledPluginIds(
      ["backup", "notes", "status-page", "tasks", "embeddings"],
      ["notes"]
    );

    expect(disabledIds).toEqual(["status-page", "tasks"]);
  });

  it("writes disabled plugin ids to the _system plugin data store", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const getAllPlugins = vi.fn(() => [
      plugin("backup"),
      plugin("embeddings"),
      plugin("notes"),
      plugin("tasks"),
    ]);
    const getPluginToken = vi.fn().mockResolvedValue("system-token");

    await persistEnabledPlugins(
      { ...INITIAL_ONBOARDING_STATE, enabledPlugins: ["notes"] },
      {
        fetchImpl,
        getAllPlugins,
        getPluginToken,
        pluginDataRoute: "/api/plugins/data",
      }
    );

    expect(getPluginToken).toHaveBeenCalledWith("_system");
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/plugins/data",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ "X-Plugin-Token": "system-token" }),
        body: JSON.stringify({
          pluginId: "_system",
          key: "disabled-plugins",
          value: JSON.stringify(["tasks"]),
        }),
      })
    );
  });

  it("throws when the plugin data write fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(
      persistEnabledPlugins(
        { ...INITIAL_ONBOARDING_STATE, enabledPlugins: ["notes"] },
        {
          fetchImpl,
          getAllPlugins: () => [plugin("backup"), plugin("embeddings"), plugin("notes")],
          getPluginToken: async () => "system-token",
          pluginDataRoute: "/api/plugins/data",
        }
      )
    ).rejects.toThrow("Failed to persist disabled plugins: 500");
  });
});
