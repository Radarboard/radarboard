/**
 * @radarboard/plugin-sdk — CRUD pattern helpers.
 *
 * Most plugins manage a collection of items (tasks, notes, bookmarks, etc.).
 * These helpers reduce the boilerplate for common create/read/update/delete
 * operations against the plugin's scoped DB.
 *
 * @example
 * ```ts
 * import { createCrudHelper } from "@radarboard/plugin-sdk/crud-helpers";
 *
 * interface Task { id: string; title: string; completed: boolean; createdAt: number }
 *
 * // In your overlay component:
 * const tasks = createCrudHelper<Task>(api, "task");
 *
 * // Create
 * const task = await tasks.create({ title: "Ship feature", completed: false });
 *
 * // List all
 * const allTasks = await tasks.list();
 *
 * // Update
 * await tasks.update(task.id, { completed: true });
 *
 * // Delete
 * await tasks.remove(task.id);
 * ```
 */

import type { PluginAPI } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An entity with a string `id` field. */
export interface Identifiable {
  id: string;
}

/**
 * CRUD operations for a keyed collection in the plugin DB.
 *
 * All operations are type-safe and scoped to a single key prefix.
 */
export interface CrudHelper<T extends Identifiable> {
  /**
   * Create a new item. Generates an `id` and `createdAt` timestamp if missing.
   *
   * @returns The created item with guaranteed `id`.
   */
  create: (data: Omit<T, "id" | "createdAt"> & { id?: string; createdAt?: number }) => Promise<T>;

  /**
   * Get a single item by ID. Returns `null` if not found.
   */
  get: (id: string) => Promise<T | null>;

  /**
   * List all items with the configured prefix.
   *
   * @param sortBy - Optional comparator for sorting results.
   */
  list: (sortBy?: (a: T, b: T) => number) => Promise<T[]>;

  /**
   * Update an existing item by merging partial fields.
   *
   * @returns The updated item, or `null` if not found.
   */
  update: (id: string, partial: Partial<Omit<T, "id">>) => Promise<T | null>;

  /**
   * Delete an item by ID.
   *
   * @returns `true` if the item existed and was deleted, `false` otherwise.
   */
  remove: (id: string) => Promise<boolean>;

  /**
   * Count all items with the configured prefix.
   */
  count: () => Promise<number>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a typed CRUD helper scoped to a DB key prefix.
 *
 * The prefix is used as `"<prefix>:<id>"` for each item key. For example,
 * `createCrudHelper(api, "task")` stores items as `"task:abc123"`.
 *
 * @param api - The PluginAPI instance (from PluginRenderProps).
 * @param prefix - The key prefix for this collection (e.g. "task", "note", "bookmark").
 *
 * @example
 * ```ts
 * interface Note { id: string; title: string; body: string; createdAt: number }
 *
 * const notes = createCrudHelper<Note>(api, "note");
 * const note = await notes.create({ title: "Hello", body: "World" });
 * const all = await notes.list((a, b) => b.createdAt - a.createdAt);
 * ```
 */
export function createCrudHelper<T extends Identifiable>(
  api: PluginAPI,
  prefix: string
): CrudHelper<T> {
  const key = (id: string) => `${prefix}:${id}`;

  return {
    async create(data) {
      const id = (data as { id?: string }).id ?? crypto.randomUUID();
      const createdAt = (data as { createdAt?: number }).createdAt ?? Date.now();
      const item = { ...data, id, createdAt } as unknown as T;
      await api.db.set(key(id), item);
      return item;
    },

    async get(id) {
      return api.db.get<T>(key(id));
    },

    async list(sortBy) {
      const items = await api.db.list<T>(`${prefix}:`);
      return sortBy ? items.sort(sortBy) : items;
    },

    async update(id, partial) {
      const existing = await api.db.get<T>(key(id));
      if (!existing) return null;
      const updated = { ...existing, ...partial, id } as T;
      await api.db.set(key(id), updated);
      return updated;
    },

    async remove(id) {
      const existing = await api.db.get<T>(key(id));
      if (!existing) return false;
      await api.db.delete(key(id));
      return true;
    },

    async count() {
      const items = await api.db.list<T>(`${prefix}:`);
      return items.length;
    },
  };
}
