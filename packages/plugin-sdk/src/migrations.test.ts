import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPluginMigrations } from "./migrations";
import type { PluginAPI, PluginMigration } from "./types";

function createMockDb() {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null) as PluginAPI["db"]["get"],
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }) as PluginAPI["db"]["set"],
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }) as PluginAPI["db"]["delete"],
    list: vi.fn(async () => []) as PluginAPI["db"]["list"],
  };
}

describe("runPluginMigrations", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("stamps version on fresh install with no migrations", async () => {
    const result = await runPluginMigrations(db, [], "1.0.0");

    expect(result).toEqual({ applied: 0, currentVersion: "1.0.0" });
    expect(db.store.get("_meta:version")).toBe("1.0.0");
  });

  it("stamps version on fresh install with migrations (skips them)", async () => {
    const migrations: PluginMigration[] = [{ version: "1.1.0", up: vi.fn() }];

    const result = await runPluginMigrations(db, migrations, "1.1.0");

    expect(result).toEqual({ applied: 0, currentVersion: "1.1.0" });
    expect(migrations[0]?.up).not.toHaveBeenCalled();
  });

  it("runs pending migrations in order", async () => {
    db.store.set("_meta:version", "1.0.0");

    const order: string[] = [];
    const migrations: PluginMigration[] = [
      {
        version: "1.1.0",
        up: vi.fn(async () => {
          order.push("1.1.0");
        }),
      },
      {
        version: "1.2.0",
        up: vi.fn(async () => {
          order.push("1.2.0");
        }),
      },
    ];

    const result = await runPluginMigrations(db, migrations, "1.2.0");

    expect(result).toEqual({ applied: 2, currentVersion: "1.2.0" });
    expect(order).toEqual(["1.1.0", "1.2.0"]);
    expect(db.store.get("_meta:version")).toBe("1.2.0");
  });

  it("skips already-applied migrations", async () => {
    db.store.set("_meta:version", "1.1.0");

    const migrations: PluginMigration[] = [
      { version: "1.1.0", up: vi.fn() },
      { version: "1.2.0", up: vi.fn() },
    ];

    const result = await runPluginMigrations(db, migrations, "1.2.0");

    expect(result).toEqual({ applied: 1, currentVersion: "1.2.0" });
    expect(migrations[0]?.up).not.toHaveBeenCalled();
    expect(migrations[1]?.up).toHaveBeenCalledOnce();
  });

  it("does nothing when already at target version", async () => {
    db.store.set("_meta:version", "2.0.0");

    const migrations: PluginMigration[] = [{ version: "1.1.0", up: vi.fn() }];

    const result = await runPluginMigrations(db, migrations, "2.0.0");

    expect(result).toEqual({ applied: 0, currentVersion: "2.0.0" });
    expect(migrations[0]?.up).not.toHaveBeenCalled();
  });

  it("stamps target version even when it's beyond the last migration", async () => {
    db.store.set("_meta:version", "1.0.0");

    const migrations: PluginMigration[] = [{ version: "1.1.0", up: vi.fn() }];

    const result = await runPluginMigrations(db, migrations, "2.0.0");

    expect(result).toEqual({ applied: 1, currentVersion: "2.0.0" });
    expect(db.store.get("_meta:version")).toBe("2.0.0");
  });

  it("migration can read and write plugin data", async () => {
    db.store.set("_meta:version", "1.0.0");
    db.store.set("items", [{ name: "old" }]);

    const migrations: PluginMigration[] = [
      {
        version: "1.1.0",
        up: async (dbApi) => {
          const items = await dbApi.get<Array<{ name: string }>>("items");
          if (items) {
            await dbApi.set(
              "items",
              items.map((i) => ({ ...i, migrated: true }))
            );
          }
        },
      },
    ];

    await runPluginMigrations(db, migrations, "1.1.0");

    expect(db.store.get("items")).toEqual([{ name: "old", migrated: true }]);
  });

  it("stamps version incrementally after each migration", async () => {
    db.store.set("_meta:version", "1.0.0");

    const versionAfterFirst: string[] = [];

    const migrations: PluginMigration[] = [
      {
        version: "1.1.0",
        up: async () => {
          versionAfterFirst.push(db.store.get("_meta:version") as string);
        },
      },
      {
        version: "1.2.0",
        up: async () => {
          versionAfterFirst.push(db.store.get("_meta:version") as string);
        },
      },
    ];

    await runPluginMigrations(db, migrations, "1.2.0");

    // Before first migration runs, version is still 1.0.0
    // After first migration, it's stamped to 1.1.0
    expect(versionAfterFirst[0]).toBe("1.0.0");
    expect(versionAfterFirst[1]).toBe("1.1.0");
  });
});
