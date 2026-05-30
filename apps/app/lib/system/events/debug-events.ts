import type {
  DebugConfig,
  DebugEventQuery,
  DebugEventRow,
  DebugNotificationPromotionRule,
} from "@radarboard/types/database";
import { getDebugRepo, getSettingsRepo } from "@/data/core/repository";
import { matchesNotificationGlob } from "@/lib/notification-glob";
import { emitNotificationEvent } from "@/lib/notifications";

export interface NewDebugEventInput {
  level: DebugEventRow["level"];
  source: string;
  eventType: string;
  message: string;
  projectSlug?: string | null;
  traceId?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  status?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

const DEFAULT_DEBUG_CONFIG: Required<Pick<DebugConfig, "promotionEnabled" | "promotionRules">> = {
  promotionEnabled: true,
  promotionRules: [
    {
      id: "api-failures",
      enabled: true,
      sourcePattern: "api/*",
      eventTypePattern: "*.failed",
      level: "error",
      severity: "warning",
    },
    {
      id: "chat-rejections",
      enabled: true,
      sourcePattern: "api/chat",
      eventTypePattern: "chat.request.rejected",
      level: null,
      severity: "warning",
    },
    {
      id: "webhook-rejections",
      enabled: true,
      sourcePattern: "api/webhooks",
      eventTypePattern: "webhook.rejected",
      level: null,
      severity: "warning",
    },
    {
      id: "negative-feedback",
      enabled: true,
      sourcePattern: "api/chat/feedback",
      eventTypePattern: "assistant.response.feedback.downvote",
      level: null,
      severity: "info",
    },
  ],
};
const DEFAULT_METADATA_MAX_BYTES = 8_192;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_REDACTION_ENABLED = true;
const REDACTED = "[REDACTED]";
const MAX_SANITIZE_DEPTH = 6;

const DEFAULT_SENSITIVE_KEY_PATTERNS = [
  /authorization/i,
  /auth[_-]?header/i,
  /token/i,
  /secret/i,
  /password/i,
  /api[_-]?key/i,
  /access[_-]?key/i,
  /refresh[_-]?token/i,
  /client[_-]?secret/i,
];

let debugConfigCache: {
  expiresAt: number;
  value: DebugConfig;
} | null = null;
let debugPruneCache: {
  expiresAt: number;
} | null = null;

export function resetDebugConfigCacheForTests(): void {
  debugConfigCache = null;
  debugPruneCache = null;
}

export async function emitDebugEvent(input: NewDebugEventInput): Promise<string | null> {
  const now = new Date().toISOString();
  const config = await getCachedDebugConfig();
  const metadata = sanitizeAndCapMetadata(input.metadata ?? {}, config);
  const event: DebugEventRow = {
    id: crypto.randomUUID(),
    occurredAt: input.occurredAt ?? now,
    ingestedAt: now,
    level: input.level,
    source: input.source,
    eventType: input.eventType,
    message: input.message,
    projectSlug: input.projectSlug ?? null,
    traceId: input.traceId ?? null,
    requestId: input.requestId ?? null,
    sessionId: input.sessionId ?? null,
    conversationId: input.conversationId ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    status: input.status ?? null,
    durationMs: input.durationMs ?? null,
    metadata: JSON.stringify(metadata),
  };

  try {
    await getDebugRepo().insertEvent(event);
    await maybePruneDebugEvents(config);
    await maybePromoteDebugEvent(event, metadata, config);
    return event.id;
  } catch {
    return null;
  }
}

export async function queryDebugEvents(
  query: DebugEventQuery = {}
): Promise<Array<Omit<DebugEventRow, "metadata"> & { metadata: Record<string, unknown> }>> {
  const rows = await getDebugRepo().listEvents(query);
  return rows.map((row) => ({
    ...row,
    metadata: parseMetadata(row.metadata),
  }));
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function maybePromoteDebugEvent(
  event: DebugEventRow,
  metadata: Record<string, unknown>,
  config: DebugConfig
): Promise<void> {
  if (config.promotionEnabled === false) return;

  const rule = matchPromotionRule(
    event,
    config.promotionRules ?? DEFAULT_DEBUG_CONFIG.promotionRules
  );
  if (!rule) return;

  const debugEventMetadata = {
    ...metadata,
    debugEventId: event.id,
    debugEventType: event.eventType,
    debugEventSource: event.source,
    traceId: event.traceId,
    requestId: event.requestId,
    conversationId: event.conversationId,
    entityType: event.entityType,
    entityId: event.entityId,
    status: event.status,
    durationMs: event.durationMs,
  };

  await emitNotificationEvent({
    source: event.source,
    type: event.eventType,
    severity: rule.severity,
    projectSlug: event.projectSlug,
    title: humanizeDebugEventTitle(event),
    body: buildNotificationBody(event, metadata),
    metadata: debugEventMetadata,
  }).catch(() => {
    // Best-effort only — debug persistence must not fail because notification delivery failed.
  });
}

/** Turn raw debug event messages into user-friendly notification titles. */
function humanizeDebugEventTitle(event: DebugEventRow): string {
  // API request failures: "POST /api/dev/debug/events failed" → "API request failed"
  if (event.eventType === "api.request" && event.status === "failed") {
    return "API request failed";
  }
  // Client-side API failures: "Client API request failed: POST /api/..." → "Service request failed"
  if (event.eventType === "client.api.failed") {
    return "Service request failed";
  }
  // Integration-related failures
  if (event.source.startsWith("integration/") || event.source.startsWith("integrations/")) {
    const integration = event.source.split("/")[1] ?? "service";
    const name = integration.charAt(0).toUpperCase() + integration.slice(1);
    return event.status === "failed" ? `${name} sync failed` : `${name} issue`;
  }
  // Plugin failures
  if (event.source.startsWith("plugin/")) {
    const plugin = event.source.split("/")[1] ?? "plugin";
    const name = plugin.charAt(0).toUpperCase() + plugin.slice(1);
    return event.status === "failed" ? `${name} plugin error` : `${name} plugin issue`;
  }
  // Lifecycle events
  if (event.eventType === "lifecycle.startup_failed") {
    return "App startup issue";
  }
  // Fallback: use the original message as-is for unrecognized event types
  return event.message;
}

async function getCachedDebugConfig(): Promise<DebugConfig> {
  const now = Date.now();
  if (debugConfigCache && debugConfigCache.expiresAt > now) {
    return debugConfigCache.value;
  }

  try {
    const config = await getSettingsRepo().getDebugConfig();
    debugConfigCache = {
      expiresAt: now + 5_000,
      value: {
        promotionEnabled: config.promotionEnabled ?? DEFAULT_DEBUG_CONFIG.promotionEnabled,
        promotionRules: config.promotionRules ?? DEFAULT_DEBUG_CONFIG.promotionRules,
        metadataRedactionEnabled: config.metadataRedactionEnabled ?? DEFAULT_REDACTION_ENABLED,
        additionalRedactedKeys: config.additionalRedactedKeys ?? [],
        metadataMaxBytes: config.metadataMaxBytes ?? DEFAULT_METADATA_MAX_BYTES,
        retentionDays: config.retentionDays ?? DEFAULT_RETENTION_DAYS,
      },
    };
    return debugConfigCache.value;
  } catch {
    return {
      ...DEFAULT_DEBUG_CONFIG,
      metadataRedactionEnabled: DEFAULT_REDACTION_ENABLED,
      additionalRedactedKeys: [],
      metadataMaxBytes: DEFAULT_METADATA_MAX_BYTES,
      retentionDays: DEFAULT_RETENTION_DAYS,
    };
  }
}

function matchPromotionRule(
  event: DebugEventRow,
  rules: DebugNotificationPromotionRule[]
): DebugNotificationPromotionRule | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (event.source === "api/notifications/emit") continue;
    if (rule.sourcePattern && !matchesNotificationGlob(event.source, rule.sourcePattern)) continue;
    if (rule.eventTypePattern && !matchesNotificationGlob(event.eventType, rule.eventTypePattern))
      continue;
    if (rule.level && rule.level !== event.level) continue;
    return rule;
  }
  return null;
}

function buildNotificationBody(
  event: DebugEventRow,
  metadata: Record<string, unknown>
): string | null {
  const fragments = [
    event.projectSlug ? `project=${event.projectSlug}` : null,
    event.entityType && event.entityId ? `${event.entityType}=${event.entityId}` : null,
    event.traceId ? `trace=${event.traceId}` : null,
    typeof metadata.error === "string" ? `error=${metadata.error}` : null,
  ].filter(Boolean);

  return fragments.length > 0 ? fragments.join(" · ") : null;
}

function sanitizeAndCapMetadata(
  metadata: Record<string, unknown>,
  config: DebugConfig
): Record<string, unknown> {
  const sanitized = sanitizeValue(
    metadata,
    config.metadataRedactionEnabled ?? DEFAULT_REDACTION_ENABLED,
    0,
    buildSensitiveKeyPatterns(config.additionalRedactedKeys ?? [])
  ) as Record<string, unknown>;

  const raw = JSON.stringify(sanitized);
  const maxBytes = config.metadataMaxBytes ?? DEFAULT_METADATA_MAX_BYTES;
  if (raw.length <= maxBytes) return sanitized;

  return {
    __truncated: true,
    originalBytes: raw.length,
    maxBytes,
    preview: raw.slice(0, Math.max(0, maxBytes - 128)),
  };
}

function sanitizeString(value: string, redactionEnabled: boolean): string {
  if (redactionEnabled && /^Bearer\s+/i.test(value)) return REDACTED;
  return value.length > 2_000 ? `${value.slice(0, 2_000)}…` : value;
}

function sanitizeError(value: Error): { name: string; message: string; stack?: string } {
  return {
    name: value.name,
    message: value.message,
    stack: value.stack ? value.stack.slice(0, 4_000) : undefined,
  };
}

function sanitizeValue(
  value: unknown,
  redactionEnabled: boolean,
  depth: number,
  sensitiveKeyPatterns: RegExp[],
  parentKey?: string
): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return "[MAX_DEPTH]";

  if (redactionEnabled && parentKey && isSensitiveKey(parentKey, sensitiveKeyPatterns)) {
    return REDACTED;
  }

  if (typeof value === "string") return sanitizeString(value, redactionEnabled);

  if (
    value == null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (value instanceof Error) return sanitizeError(value);

  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((entry) => sanitizeValue(entry, redactionEnabled, depth + 1, sensitiveKeyPatterns));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 100);
    return Object.fromEntries(
      entries.map(([key, childValue]) => [
        key,
        sanitizeValue(childValue, redactionEnabled, depth + 1, sensitiveKeyPatterns, key),
      ])
    );
  }

  return String(value);
}

function buildSensitiveKeyPatterns(additionalKeys: string[]): RegExp[] {
  const extraPatterns = additionalKeys
    .map((key) => key.trim())
    .filter((key) => key.length > 0)
    .map((key) => new RegExp(`^${escapeRegex(key)}$`, "i"));
  return [...DEFAULT_SENSITIVE_KEY_PATTERNS, ...extraPatterns];
}

function isSensitiveKey(key: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(key));
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

async function maybePruneDebugEvents(config: DebugConfig): Promise<void> {
  const retentionDays = config.retentionDays ?? DEFAULT_RETENTION_DAYS;
  if (retentionDays <= 0) return;

  const now = Date.now();
  if (debugPruneCache && debugPruneCache.expiresAt > now) return;

  debugPruneCache = { expiresAt: now + 60 * 60 * 1000 };
  const olderThan = new Date(now - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  await getDebugRepo()
    .pruneEvents(olderThan)
    .catch(() => {
      // Best-effort only
    });
}

// Auto-initialize logger observer on server-side startup
function handleLogObserverEvent(entry: {
  level: "debug" | "info" | "warn" | "error";
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}) {
  // We only automatically promote 'error' and 'warn' levels to debug events
  if (entry.level !== "error" && entry.level !== "warn") return;

  // Fire and forget — we don't want to block the request on persistence
  emitDebugEvent({
    level: entry.level,
    source: entry.source,
    eventType: entry.level === "error" ? "error.logged" : "warning.logged",
    message: entry.message,
    metadata: entry.metadata,
    occurredAt: new Date(entry.timestamp).toISOString(),
  }).catch(() => {
    // Best-effort
  });
}

if (typeof window === "undefined") {
  (async () => {
    try {
      const { addLogObserver } = await import("@radarboard/logger");
      addLogObserver(handleLogObserverEvent);
    } catch {
      // Failed to load logger, silent ignore
    }
  })().catch(() => {
    // Ignore IIFE error
  });
}
