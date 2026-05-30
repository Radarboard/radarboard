import type { IntentPayload, IntentResult } from "@radarboard/types/intent";
import { afterEach, describe, expect, it } from "vitest";
import { createMockPluginAPI, createTestPluginHost } from "./testing";
import type { PluginDescriptor } from "./types";

function makeDescriptor(id: string, overrides?: Partial<PluginDescriptor>): PluginDescriptor {
  return {
    id,
    name: id,
    description: `Test plugin ${id}`,
    icon: () => null,
    category: "productivity",
    version: "1.0.0",
    launchSurfaces: ["palette"],
    presentation: "fullscreen",
    component: () => null,
    ...overrides,
  } as unknown as PluginDescriptor;
}

describe("createMockPluginAPI (tracked)", () => {
  it("tracks notify calls", () => {
    const api = createMockPluginAPI();
    api.notify("Hello", "success");
    api.notify("Oops", "error");

    expect(api.notifications).toEqual([
      { message: "Hello", type: "success" },
      { message: "Oops", type: "error" },
    ]);
  });

  it("tracks close calls", () => {
    const api = createMockPluginAPI();
    api.close();
    api.close();

    expect(api.closeCount).toBe(2);
  });

  it("tracks emitted events", () => {
    const api = createMockPluginAPI();
    api.events.emit({
      type: "deploy",
      severity: "info",
      title: "Deploy started",
    });

    expect(api.emittedEvents).toHaveLength(1);
    expect(api.emittedEvents[0]?.type).toBe("deploy");
  });

  it("DB operations work with in-memory store", async () => {
    const api = createMockPluginAPI();

    await api.db.set("tasks:1", { id: "1", title: "Buy milk" });
    const result = await api.db.get<{ id: string; title: string }>("tasks:1");
    expect(result).toEqual({ id: "1", title: "Buy milk" });

    const list = await api.db.list<{ id: string; title: string }>("tasks:");
    expect(list).toHaveLength(1);

    await api.db.delete("tasks:1");
    expect(await api.db.get("tasks:1")).toBeNull();
  });

  it("resetTracking clears all tracked state", () => {
    const api = createMockPluginAPI();
    api.notify("test");
    api.close();
    api.events.emit({ type: "x", severity: "info", title: "X" });

    api.resetTracking();

    expect(api.notifications).toHaveLength(0);
    expect(api.closeCount).toBe(0);
    expect(api.emittedEvents).toHaveLength(0);
  });

  it("exposes dbStore for direct assertions", async () => {
    const api = createMockPluginAPI();
    await api.db.set("key", "value");

    expect(api.dbStore.has("key")).toBe(true);
    expect(JSON.parse(api.dbStore.get("key")!)).toBe("value");
  });
});

describe("createTestPluginHost", () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  it("registers descriptors and provides scoped APIs", () => {
    const host = createTestPluginHost([makeDescriptor("tasks"), makeDescriptor("notes")]);
    cleanup = host.cleanup;

    const tasksApi = host.getAPI("tasks");
    const notesApi = host.getAPI("notes");

    expect(tasksApi).toBeDefined();
    expect(notesApi).toBeDefined();
    // Same API returned on second call
    expect(host.getAPI("tasks")).toBe(tasksApi);
  });

  it("isolates DB between plugins", async () => {
    const host = createTestPluginHost([makeDescriptor("tasks"), makeDescriptor("notes")]);
    cleanup = host.cleanup;

    const tasksApi = host.getAPI("tasks");
    const notesApi = host.getAPI("notes");

    await tasksApi.db.set("item:1", "task data");
    await notesApi.db.set("item:1", "note data");

    expect(await tasksApi.db.get("item:1")).toBe("task data");
    expect(await notesApi.db.get("item:1")).toBe("note data");
  });

  it("supports real cross-plugin intent dispatch", async () => {
    const receivedPayloads: IntentPayload[] = [];

    const host = createTestPluginHost([
      makeDescriptor("sender"),
      makeDescriptor("receiver", {
        intents: [
          {
            action: "create-bookmark",
            label: "Add Bookmark",
            accepts: ["link"],
            handle: async (payload: IntentPayload): Promise<IntentResult> => {
              receivedPayloads.push(payload);
              return { success: true, message: "Bookmarked!" };
            },
          },
        ],
      }),
    ]);
    cleanup = host.cleanup;

    const senderApi = host.getAPI("sender");
    const result = await senderApi.intents.sendTo("receiver", "create-bookmark", {
      kind: "link" as const,
      url: "https://example.com",
      title: "Example",
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe("Bookmarked!");
    expect(receivedPayloads).toHaveLength(1);
    const payload = receivedPayloads[0];
    expect(payload?.kind).toBe("link");
    if (payload?.kind === "link") {
      expect(payload.url).toBe("https://example.com");
    }
  });

  it("resolves intent targets across registered plugins", () => {
    const host = createTestPluginHost([
      makeDescriptor("sender"),
      makeDescriptor("receiver", {
        intents: [
          {
            action: "create-task",
            label: "Add Task",
            accepts: ["text"],
            handle: async () => ({ success: true }),
          },
        ],
      }),
    ]);
    cleanup = host.cleanup;

    const senderApi = host.getAPI("sender");
    const targets = senderApi.intents.resolveTargets({
      kind: "text",
      title: "Buy milk",
      sourcePluginId: "sender",
    } as IntentPayload);

    expect(targets).toHaveLength(1);
    expect(targets[0]?.pluginId).toBe("receiver");
    expect(targets[0]?.action).toBe("create-task");
  });

  it("cleanup clears all state", async () => {
    const host = createTestPluginHost([makeDescriptor("tasks")]);
    const api = host.getAPI("tasks");
    await api.db.set("key", "value");

    host.cleanup();

    // After cleanup, creating a new host starts fresh
    const host2 = createTestPluginHost([makeDescriptor("tasks")]);
    cleanup = host2.cleanup;
    const api2 = host2.getAPI("tasks");
    expect(await api2.db.get("key")).toBeNull();
  });
});
