import { afterEach, beforeEach, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  watch: vi.fn(),
}));
vi.mock("node:path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
}));

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  configExists,
  getDatabaseConfig,
  invalidateConfigCache,
  readConfig,
  setDatabaseConfig,
  writeConfig,
} from "../radarboard-config";

const mockedExistsSync = vi.mocked(existsSync);
const mockedMkdirSync = vi.mocked(mkdirSync);
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);

const DEFAULT_CONFIG = {
  database: {
    provider: "sqlite",
  },
};

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  delete process.env.DATABASE_PROVIDER;
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  invalidateConfigCache();
  mockedMkdirSync.mockReset();
});

afterEach(() => {
  process.env = savedEnv;
});

describe("readConfig", () => {
  it("returns defaults when file doesn't exist", () => {
    mockedExistsSync.mockReturnValue(false);

    const config = readConfig();

    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("parses config file", () => {
    mockedExistsSync.mockReturnValue(true);
    const fileConfig = {
      database: {
        provider: "supabase",
        supabase: { url: "https://x.supabase.co", anonKey: "key123" },
      },
    };
    mockedReadFileSync.mockReturnValue(JSON.stringify(fileConfig));

    const config = readConfig();

    expect(config).toEqual(fileConfig);
  });

  it("parses planetscale config file with host credentials", () => {
    mockedExistsSync.mockReturnValue(true);
    const fileConfig = {
      database: {
        provider: "planetscale",
        planetscale: {
          host: "aws.connect.psdb.cloud",
          username: "radarboard",
          password: "secret",
        },
      },
    };
    mockedReadFileSync.mockReturnValue(JSON.stringify(fileConfig));

    const config = readConfig();

    expect(config).toEqual(fileConfig);
  });

  it("returns defaults on JSON parse error", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue("not valid json {{{");

    const config = readConfig();

    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

describe("writeConfig", () => {
  it("writes formatted JSON", () => {
    const config = { database: { provider: "turso" as const } };

    writeConfig(config);

    expect(mockedWriteFileSync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(config, null, 2),
      "utf-8"
    );
  });
});

describe("configExists", () => {
  it("returns true when file exists", () => {
    mockedExistsSync.mockReturnValue(true);

    expect(configExists()).toBe(true);
  });

  it("returns false when file missing", () => {
    mockedExistsSync.mockReturnValue(false);

    expect(configExists()).toBe(false);
  });
});

describe("getDatabaseConfig", () => {
  it("uses env var override when set", () => {
    process.env.DATABASE_PROVIDER = "supabase";

    const config = getDatabaseConfig();

    expect(config.provider).toBe("supabase");
  });

  it("reads from config file when no env var", () => {
    delete process.env.DATABASE_PROVIDER;
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        database: {
          provider: "planetscale",
          planetscale: {
            host: "aws.connect.psdb.cloud",
            username: "radarboard",
            password: "secret",
          },
        },
      })
    );

    const config = getDatabaseConfig();

    expect(config).toEqual({
      provider: "planetscale",
      planetscale: {
        host: "aws.connect.psdb.cloud",
        username: "radarboard",
        password: "secret",
      },
    });
  });

  it("includes Turso env vars when DATABASE_PROVIDER=turso", () => {
    process.env.DATABASE_PROVIDER = "turso";
    process.env.TURSO_DATABASE_URL = "libsql://my-db.turso.io";
    process.env.TURSO_AUTH_TOKEN = "token123";

    const config = getDatabaseConfig();

    expect(config).toEqual({
      provider: "turso",
      turso: {
        url: "libsql://my-db.turso.io",
        authToken: "token123",
      },
    });
  });

  it("sets turso.authToken to empty string when TURSO_AUTH_TOKEN is not set", () => {
    process.env.DATABASE_PROVIDER = "turso";
    process.env.TURSO_DATABASE_URL = "libsql://my-db.turso.io";
    delete process.env.TURSO_AUTH_TOKEN;

    const config = getDatabaseConfig();

    expect(config.turso?.authToken).toBe("");
  });
});

describe("setDatabaseConfig", () => {
  it("reads existing config, updates database section, writes back", () => {
    const existingConfig = {
      database: { provider: "sqlite" as const },
    };
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify(existingConfig));

    const newDbConfig = {
      provider: "supabase" as const,
      supabase: { url: "https://x.supabase.co", anonKey: "key" },
    };

    setDatabaseConfig(newDbConfig);

    const expectedWritten = { database: newDbConfig };
    expect(mockedWriteFileSync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(expectedWritten, null, 2),
      "utf-8"
    );
  });
});
