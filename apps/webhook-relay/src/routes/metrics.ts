/**
 * GET /api/metrics
 *
 * Prometheus-compatible metrics endpoint. Scrape this with Grafana,
 * Datadog, Prometheus, or any monitoring tool.
 */

import { Hono } from "hono";
import { renderMetrics } from "../lib/metrics.js";

export function metricsRoute(): Hono {
  const route = new Hono();

  route.get("/", (c) => {
    return c.text(renderMetrics(), 200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
  });

  return route;
}
