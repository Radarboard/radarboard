/* biome-ignore-all lint/correctness/useHookAtTopLevel: template placeholders are expanded into valid component identifiers when scaffolding a real plugin. */
/* biome-ignore-all lint/nursery/useSortedClasses: template starter code favors readable class examples over final class ordering. */
"use client";

import { PluginEmptyState } from "@radarboard/plugin-sdk/components/plugin-empty";
import { createCrudHelper } from "@radarboard/plugin-sdk/crud-helpers";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { Button } from "@radarboard/ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { __PLUGIN_PASCAL__Item } from "../types";

/**
 * __PLUGIN_NAME__ — Main overlay component
 *
 * This component receives `api` (PluginAPI) via props, giving you access to:
 * - `api.db`      — Key-value storage scoped to this plugin
 * - `api.notify`  — Toast notifications
 * - `api.hotkeys` — Register keyboard shortcuts
 * - `api.close`   — Close the plugin overlay
 * - `api.events`  — Emit/subscribe to notification events
 * - `api.intents` — Cross-plugin communication
 *
 * The CRUD helper (`createCrudHelper`) wraps api.db with typed create/get/list/update/remove
 * operations so you don't have to manage key prefixes or JSON serialization manually.
 *
 * See the full PluginAPI reference in @radarboard/plugin-sdk/types.
 */
export function __PLUGIN_PASCAL__Overlay({ api }: PluginRenderProps) {
  const [items, setItems] = useState<__PLUGIN_PASCAL__Item[]>([]);

  // Create a typed CRUD helper for "item:" prefixed keys
  const crud = useMemo(() => createCrudHelper<__PLUGIN_PASCAL__Item>(api, "item"), [api]);

  // Load items from plugin DB on mount
  useEffect(() => {
    crud.list((a, b) => b.createdAt - a.createdAt).then(setItems);
  }, [crud]);

  // Register a keyboard shortcut (auto-cleaned up on unmount)
  useEffect(() => {
    return api.hotkeys.register("n", () => {
      api.notify("Shortcut triggered! Implement your action here.");
    });
  }, [api.hotkeys, api.notify]);

  const addItem = useCallback(async () => {
    const item = await crud.create({
      title: `Item ${items.length + 1}`,
      completed: false,
    });
    setItems((prev) => [item, ...prev]);
    api.notify(`Created "${item.title}"`, "success");
  }, [crud, api, items.length]);

  const toggleItem = useCallback(
    async (id: string) => {
      const existing = items.find((i) => i.id === id);
      if (!existing) return;
      const updated = await crud.update(id, { completed: !existing.completed });
      if (updated) {
        setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      }
    },
    [crud, items]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      await crud.remove(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      api.notify("Item deleted", "info");
    },
    [crud, api]
  );

  if (items.length === 0) {
    return (
      <PluginEmptyState
        title="__PLUGIN_NAME__"
        description="No items yet. Create your first one to get started."
        action={{ label: "Create Item", onClick: addItem }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <h2 className="text-lg font-semibold">__PLUGIN_NAME__</h2>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 rounded border p-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleItem(item.id)}
              className="shrink-0 p-0"
            >
              {item.completed ? "✓" : "○"}
            </Button>
            <span className={item.completed ? "line-through text-dim" : ""}>{item.title}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteItem(item.id)}
              className="ml-auto p-0 text-destructive/70 hover:text-destructive"
            >
              ×
            </Button>
          </li>
        ))}
      </ul>
      <Button onClick={addItem} className="mt-2" size="sm">
        Add Item
      </Button>
    </div>
  );
}
