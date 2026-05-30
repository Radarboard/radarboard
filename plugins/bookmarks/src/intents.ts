import type { PluginAPI, PluginIntentHandler } from "@radarboard/plugin-sdk/types";
import type { IntentResult, LinkIntentPayload } from "@radarboard/types/intent";
import type { Bookmark } from "./types";

const DB_KEY = "bookmarks:list";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const bookmarksIntents: PluginIntentHandler[] = [
  {
    action: "create-bookmark",
    label: "Save as Bookmark",
    accepts: ["link"],
    handle: async (payload, api: PluginAPI): Promise<IntentResult> => {
      const linkPayload = payload as LinkIntentPayload;
      const bookmarks = (await api.db.get<Bookmark[]>(DB_KEY)) ?? [];
      const bookmark: Bookmark = {
        id: generateId(),
        title: linkPayload.title,
        url: linkPayload.url,
        description: linkPayload.description,
        tags: linkPayload.tags ?? [],
        createdAt: new Date().toISOString(),
      };
      bookmarks.push(bookmark);
      await api.db.set(DB_KEY, bookmarks);
      return { success: true, message: "Bookmark saved", createdItemId: bookmark.id };
    },
  },
];
