import type { ProviderInfo } from "@radarboard/types/database";

/** Registry of all supported database providers with their UI metadata. */
export const DATABASE_PROVIDERS: ProviderInfo[] = [
  {
    id: "sqlite",
    name: "SQLite",
    description: "Local file-based database. No setup required. Data stays on your machine.",
    fields: [],
    docsUrl: "https://sqlite.org/",
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Postgres-based backend. Free tier available. Cross-device sync.",
    fields: [
      {
        key: "url",
        label: "Project URL",
        type: "url",
        placeholder: "https://xxxxx.supabase.co",
        required: true,
        helpText: "Found in Settings > API > Project URL",
      },
      {
        key: "anonKey",
        label: "Anon Key",
        type: "password",
        placeholder: "eyJhbGciOiJIUzI1NiIs...",
        required: true,
        helpText: "Found in Settings > API > anon public key",
      },
    ],
    docsUrl: "https://supabase.com/docs",
  },
  {
    id: "turso",
    name: "Turso",
    description: "Distributed SQLite at the edge. Fast reads, global replication.",
    fields: [
      {
        key: "url",
        label: "Database URL",
        type: "url",
        placeholder: "libsql://your-db.turso.io",
        required: true,
        helpText: "From: turso db show --url <db-name>",
      },
      {
        key: "authToken",
        label: "Auth Token",
        type: "password",
        placeholder: "eyJhbGciOiJFZERTQSIs...",
        required: true,
        helpText: "From: turso db tokens create <db-name>",
      },
    ],
    docsUrl: "https://docs.turso.tech/",
  },
  {
    id: "planetscale",
    name: "PlanetScale",
    description: "MySQL-compatible serverless database. Branching workflows.",
    fields: [
      {
        key: "host",
        label: "Host",
        type: "text",
        placeholder: "xxx.connect.psdb.cloud",
        required: true,
        helpText: "From your PlanetScale connection string",
      },
      {
        key: "username",
        label: "Username",
        type: "text",
        placeholder: "xxxxxxxxxx",
        required: true,
      },
      {
        key: "password",
        label: "Password",
        type: "password",
        placeholder: "pscale_pw_...",
        required: true,
      },
    ],
    docsUrl: "https://planetscale.com/docs",
  },
];
