"use client";

import { isClientE2EMode } from "@/lib/e2e";

type ClientDebugPayload = {
  level: "debug" | "info" | "warn" | "error";
  source: string;
  eventType: string;
  message: string;
  status?: string | null;
  metadata?: Record<string, unknown>;
};

const SESSION_STORAGE_KEY = "radarboard:debug-session-id";
const FINGERPRINT_TTL_MS = 30_000;

let initialized = false;
let sessionId: string | null = null;
const fingerprintCache = new Map<string, number>();

export function initClientDebugInstrumentation(): void {
  if (initialized || typeof window === "undefined") return;
  if (isClientE2EMode()) return;
  initialized = true;

  window.addEventListener("error", handleWindowError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  window.addEventListener("radarboard:error-boundary", handleErrorBoundaryEvent as EventListener);

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = normalizeUrl(input);
    const method = (init?.method ?? "GET").toUpperCase();

    try {
      const response = await originalFetch(input, init);
      reportFailedApiResponse(url, method, response);
      return response;
    } catch (error) {
      reportApiException(url, method, error);
      throw error;
    }
  };
}

function isMonitoredApiUrl(url: URL | null): url is URL {
  return url !== null && isInternalApiUrl(url) && !isDebugIngressUrl(url);
}

function reportFailedApiResponse(url: URL | null, method: string, response: Response): void {
  if (!isMonitoredApiUrl(url) || response.ok) return;
  const fingerprint = `api:${method}:${url.pathname}:${response.status}`;
  if (!shouldEmitFingerprint(fingerprint)) return;
  emitClientDebugEvent({
    level: response.status >= 500 ? "error" : "warn",
    source: "client/api",
    eventType: "client.api.failed",
    message: `Client API request failed: ${method} ${url.pathname}`,
    status: "failed",
    metadata: { method, path: url.pathname, status: response.status, fingerprint },
  });
}

function reportApiException(url: URL | null, method: string, error: unknown): void {
  if (!isMonitoredApiUrl(url)) return;
  const fingerprint = `api:${method}:${url.pathname}:network`;
  if (!shouldEmitFingerprint(fingerprint)) return;
  emitClientDebugEvent({
    level: "error",
    source: "client/api",
    eventType: "client.api.exception",
    message: `Client API request threw: ${method} ${url.pathname}`,
    status: "failed",
    metadata: {
      method,
      path: url.pathname,
      error: error instanceof Error ? error.message : String(error),
      fingerprint,
    },
  });
}

export function captureClientIssue(payload: ClientDebugPayload): void {
  emitClientDebugEvent(payload);
}

function handleWindowError(event: ErrorEvent): void {
  const error = event.error as Error | undefined;
  const message = error?.message ?? event.message ?? "Unhandled window error";
  const fingerprint = `window:error:${message}`;
  if (!shouldEmitFingerprint(fingerprint)) return;

  emitClientDebugEvent({
    level: "error",
    source: "client/runtime",
    eventType: "client.error",
    message,
    status: "failed",
    metadata: {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: error?.stack,
      fingerprint,
    },
  });
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  const fingerprint = `window:rejection:${message}`;
  if (!shouldEmitFingerprint(fingerprint)) return;

  emitClientDebugEvent({
    level: "error",
    source: "client/runtime",
    eventType: "client.unhandled_rejection",
    message,
    status: "failed",
    metadata: {
      stack: reason instanceof Error ? reason.stack : undefined,
      reason: serializeUnknown(reason),
      fingerprint,
    },
  });
}

function handleErrorBoundaryEvent(
  event: CustomEvent<{ title?: string; message: string; stack?: string }>
) {
  const detail = event.detail;
  if (!detail) return;
  const fingerprint = `boundary:${detail.title ?? "unknown"}:${detail.message}`;
  if (!shouldEmitFingerprint(fingerprint)) return;

  emitClientDebugEvent({
    level: "error",
    source: "client/react",
    eventType: "client.error_boundary",
    message: detail.message,
    status: "failed",
    metadata: {
      title: detail.title ?? null,
      stack: detail.stack,
      fingerprint,
    },
  });
}

function emitClientDebugEvent(payload: ClientDebugPayload): void {
  const body = JSON.stringify({
    ...payload,
    sessionId: getSessionId(),
    metadata: {
      ...(payload.metadata ?? {}),
      path: window.location.pathname,
      search: window.location.search || null,
      href: window.location.href,
      userAgent: navigator.userAgent,
    },
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    const ok = navigator.sendBeacon(API_ROUTES.debugEvents, blob);
    if (ok) return;
  }

  fetch(API_ROUTES.debugEvents, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Best-effort only
  });
}

function getSessionId(): string {
  if (sessionId) return sessionId;

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      sessionId = existing;
      return existing;
    }
  } catch {
    // Ignore storage access issues
  }

  sessionId = crypto.randomUUID();
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Ignore storage access issues
  }
  return sessionId;
}

function normalizeUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === "string") return new URL(input, window.location.origin);
    if (input instanceof URL) return input;
    if (input instanceof Request) return new URL(input.url, window.location.origin);
    return null;
  } catch {
    return null;
  }
}

function isInternalApiUrl(url: URL): boolean {
  return url.origin === window.location.origin && url.pathname.startsWith("/api/");
}

function isDebugIngressUrl(url: URL): boolean {
  return url.pathname === "/api/debug/events";
}

function shouldEmitFingerprint(fingerprint: string): boolean {
  const now = Date.now();
  const lastSeen = fingerprintCache.get(fingerprint) ?? 0;
  if (now - lastSeen < FINGERPRINT_TTL_MS) return false;
  fingerprintCache.set(fingerprint, now);
  return true;
}

function serializeUnknown(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === "object" && value !== null) return value;
  return String(value);
}

import { API_ROUTES } from "@radarboard/types/api-routes";
