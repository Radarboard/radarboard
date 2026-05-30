import { createLogger } from "@radarboard/logger/logger";
import { emitDebugEvent } from "@/lib/debug-events";
import type { HttpMethod, RouteHandler } from "./types";

const log = createLogger("api/route-debug");
const RESPONSE_BODY_PREVIEW_LIMIT = 2_048;

function buildRouteSource(routePath: string) {
  return routePath.replace(/^\//, "") || "api";
}

function collectSearchParams(url: URL) {
  return Object.fromEntries(url.searchParams.entries());
}

async function readResponsePreview(response: Response): Promise<string | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json") && !contentType.startsWith("text/")) {
    return null;
  }

  try {
    const text = await response.clone().text();
    if (!text) {
      return null;
    }
    return text.length > RESPONSE_BODY_PREVIEW_LIMIT
      ? `${text.slice(0, RESPONSE_BODY_PREVIEW_LIMIT)}...`
      : text;
  } catch {
    return null;
  }
}

export async function runRouteWithDebug(input: {
  actualPath: string;
  context?: unknown;
  method: HttpMethod;
  params?: Record<string, string>;
  request: Request;
  routePath: string;
  handler: RouteHandler;
}): Promise<Response> {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const url = new URL(input.request.url);
  const source = buildRouteSource(input.routePath);
  const baseMetadata = {
    actualPath: input.actualPath,
    method: input.method,
    params: input.params ?? {},
    query: collectSearchParams(url),
    routePath: input.routePath,
  };

  await emitDebugEvent({
    level: "info",
    source,
    eventType: "route.request.started",
    message: `${input.method} ${input.actualPath} started`,
    requestId,
    status: "started",
    metadata: baseMetadata,
  });

  try {
    const response = await input.handler(input.request, input.context);
    const durationMs = Date.now() - startedAt;
    const responsePreview = response.status >= 400 ? await readResponsePreview(response) : null;
    const metadata = {
      ...baseMetadata,
      httpStatus: response.status,
      ...(responsePreview ? { responsePreview } : {}),
    };

    if (response.status >= 500) {
      await emitDebugEvent({
        level: "error",
        source,
        eventType: "route.request.failed",
        message: `${input.method} ${input.actualPath} failed`,
        requestId,
        status: "failed",
        durationMs,
        metadata,
      });
    } else if (response.status >= 400) {
      await emitDebugEvent({
        level: "warn",
        source,
        eventType: "route.request.rejected",
        message: `${input.method} ${input.actualPath} rejected`,
        requestId,
        status: "rejected",
        durationMs,
        metadata,
      });
    } else {
      await emitDebugEvent({
        level: "info",
        source,
        eventType: "route.request.completed",
        message: `${input.method} ${input.actualPath} completed`,
        requestId,
        status: "completed",
        durationMs,
        metadata,
      });
    }

    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    log.error("Route execution failed", {
      actualPath: input.actualPath,
      error,
      method: input.method,
      requestId,
      routePath: input.routePath,
    });
    await emitDebugEvent({
      level: "error",
      source,
      eventType: "route.request.failed",
      message: `${input.method} ${input.actualPath} failed`,
      requestId,
      status: "failed",
      durationMs,
      metadata: {
        ...baseMetadata,
        error: message,
      },
    });

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function emitRouteOutcome(input: {
  actualPath: string;
  method: HttpMethod;
  routePath: string;
  statusCode: 404 | 405;
}): Promise<void> {
  const requestId = crypto.randomUUID();
  const source = buildRouteSource(input.routePath);
  const level = input.statusCode === 404 ? "warn" : "warn";
  const eventType =
    input.statusCode === 404 ? "route.request.not_found" : "route.request.method_not_allowed";
  const status = input.statusCode === 404 ? "not_found" : "method_not_allowed";
  const message =
    input.statusCode === 404
      ? `${input.method} ${input.actualPath} not found`
      : `${input.method} ${input.actualPath} not allowed`;

  await emitDebugEvent({
    level,
    source,
    eventType,
    message,
    requestId,
    status,
    metadata: {
      actualPath: input.actualPath,
      httpStatus: input.statusCode,
      method: input.method,
      routePath: input.routePath,
    },
  });
}
