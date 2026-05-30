/**
 * Cloudflare Workers entry point.
 *
 * Exports the Hono app's fetch handler, which is the standard interface
 * for Cloudflare Workers. Upstash Redis uses HTTP (not TCP), so it works
 * natively on the Workers runtime without any adapters.
 */

import { app } from "./index.js";

export default {
  fetch: app.fetch,
};
