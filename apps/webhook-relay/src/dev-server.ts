/**
 * Local development server — @hono/node-server no longer exposes a CLI binary.
 * Loads .env file for local development (tsx doesn't do this automatically).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env file before importing the app (which validates env vars at init)
try {
  const envPath = resolve(import.meta.dirname ?? ".", ".env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // .env file not found — fall back to environment variables
}

import { serve } from "@hono/node-server";
import { app } from "./index.js";

const port = Number(process.env.PORT) || 8787;

serve(
  {
    fetch: app.fetch,
    port,
  },
  (_info) => {}
);
