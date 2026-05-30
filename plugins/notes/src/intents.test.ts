import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { notesIntents } from "./intents";

describe("notes intents", () => {
  it("creates markdown notes from link and structured payloads", async () => {
    const api = createMockPluginAPI("notes-test");

    const result = await notesIntents[0]!.handle(
      {
        kind: "link",
        sourcePluginId: "test",
        title: "Radarboard",
        url: "https://radarboard.app",
        description: "Control room",
        tags: ["product"],
      },
      api
    );

    expect(result.success).toBe(true);
    const stored = JSON.parse(api.dbStore.get("notes:list") ?? "[]");
    expect(stored).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Radarboard",
          content: "[Radarboard](https://radarboard.app)\n\nControl room",
          tags: ["product"],
          contentFormat: "markdown",
        }),
      ])
    );
  });
});
