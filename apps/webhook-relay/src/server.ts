/**
 * Production Node.js server for container platforms (Railway, Fly.io, Render, etc.).
 *
 * Uses @hono/node-server to serve the Hono app on a configurable port.
 * This is the entry point for `pnpm start` after building with `pnpm build:standalone`.
 */

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
