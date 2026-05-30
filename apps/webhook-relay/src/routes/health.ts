/**
 * GET /api/health
 *
 * Simple health check endpoint.
 */

import { Hono } from "hono";

export function healthRoute(): Hono {
  const route = new Hono();

  route.get("/", (c) => {
    return c.json({ status: "ok", timestamp: Date.now() });
  });

  return route;
}
