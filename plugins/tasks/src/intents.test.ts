import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { tasksIntents } from "./intents";

describe("tasks intents", () => {
  it("creates tasks from link payloads", async () => {
    const api = createMockPluginAPI("tasks-test");

    const result = await tasksIntents[0]!.handle(
      {
        kind: "link",
        sourcePluginId: "test",
        title: "Fix plugin coverage",
        url: "https://github.com/openai/codex",
        description: "Add the missing tests",
        projectSlug: "atlas",
      },
      api
    );

    expect(result.success).toBe(true);
    const stored = JSON.parse(api.dbStore.get("tasks:list") ?? "[]");
    expect(stored).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Fix plugin coverage",
          description:
            "[Fix plugin coverage](https://github.com/openai/codex)\n\nAdd the missing tests",
          projectId: "atlas",
          status: "todo",
          priority: "medium",
        }),
      ])
    );
  });
});
