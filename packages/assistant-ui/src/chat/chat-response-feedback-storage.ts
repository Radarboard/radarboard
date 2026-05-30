const STORAGE_PREFIX = "radarboard.chatResponseFeedback.v1";

export const FEEDBACK_REASON_TAGS = ["wrong", "incomplete", "tooLong", "other"] as const;
export type FeedbackReasonTag = (typeof FEEDBACK_REASON_TAGS)[number];

const REASON_TAG_SET = new Set<string>(FEEDBACK_REASON_TAGS);

export type ChatResponseFeedbackEntry = {
  vote: "down" | "up";
  reasonTag?: FeedbackReasonTag;
  note?: string;
  at: number;
};

function storageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}:${conversationId}`;
}

function parseRecordRaw(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // ignore corrupt storage
  }
  return {};
}

/** Normalize legacy `too_long` and drop invalid reason tags; coerces missing `at`. */
function normalizeEntryValue(val: unknown): {
  entry: ChatResponseFeedbackEntry | null;
  changed: boolean;
} {
  if (!val || typeof val !== "object" || Array.isArray(val)) {
    return { entry: null, changed: true };
  }
  const o = val as Record<string, unknown>;
  const vote = o.vote;
  if (vote !== "up" && vote !== "down") {
    return { entry: null, changed: true };
  }
  let changed = typeof o.at !== "number";
  const at = typeof o.at === "number" ? o.at : Date.now();

  let reasonTagRaw = o.reasonTag;
  if (reasonTagRaw === "too_long") {
    reasonTagRaw = "tooLong";
    changed = true;
  }
  let reasonTag: FeedbackReasonTag | undefined;
  if (typeof reasonTagRaw === "string" && REASON_TAG_SET.has(reasonTagRaw)) {
    reasonTag = reasonTagRaw as FeedbackReasonTag;
  } else if (reasonTagRaw !== undefined && reasonTagRaw !== null) {
    changed = true;
  }

  const note = typeof o.note === "string" ? o.note : undefined;

  const entry: ChatResponseFeedbackEntry = {
    vote,
    at,
    ...(reasonTag ? { reasonTag } : {}),
    ...(note ? { note } : {}),
  };
  return { entry, changed };
}

function normalizeFeedbackMap(rawMap: Record<string, unknown>): {
  map: Record<string, ChatResponseFeedbackEntry>;
  dirty: boolean;
} {
  const map: Record<string, ChatResponseFeedbackEntry> = {};
  let dirty = false;
  for (const [id, val] of Object.entries(rawMap)) {
    const { entry, changed } = normalizeEntryValue(val);
    if (entry) {
      map[id] = entry;
    }
    if (changed || entry === null) {
      dirty = true;
    }
  }
  return { map, dirty };
}

function getNormalizedMap(conversationId: string): Record<string, ChatResponseFeedbackEntry> {
  const key = storageKey(conversationId);
  const rawMap = parseRecordRaw(sessionStorage.getItem(key));
  const { map, dirty } = normalizeFeedbackMap(rawMap);
  if (dirty) {
    sessionStorage.setItem(key, JSON.stringify(map));
  }
  return map;
}

function persistMap(conversationId: string, map: Record<string, ChatResponseFeedbackEntry>): void {
  sessionStorage.setItem(storageKey(conversationId), JSON.stringify(map));
}

export function getFeedback(
  conversationId: string | null,
  messageId: string
): ChatResponseFeedbackEntry | null {
  if (!conversationId || typeof window === "undefined") return null;
  const map = getNormalizedMap(conversationId);
  return map[messageId] ?? null;
}

export function setFeedback(
  conversationId: string | null,
  messageId: string,
  entry: ChatResponseFeedbackEntry | null
): void {
  if (!conversationId || typeof window === "undefined") return;
  const map = getNormalizedMap(conversationId);
  if (entry === null) {
    if (messageId in map) {
      delete map[messageId];
      persistMap(conversationId, map);
    }
    return;
  }
  map[messageId] = entry;
  persistMap(conversationId, map);
}

export function patchFeedbackDown(
  conversationId: string | null,
  messageId: string,
  patch: { note?: string; reasonTag?: FeedbackReasonTag }
): void {
  if (!conversationId || typeof window === "undefined") return;
  const prev = getFeedback(conversationId, messageId);
  const base: ChatResponseFeedbackEntry =
    prev?.vote === "down"
      ? prev
      : {
          vote: "down",
          at: Date.now(),
        };
  const next: ChatResponseFeedbackEntry = {
    ...base,
    vote: "down",
    ...patch,
    at: Date.now(),
  };
  setFeedback(conversationId, messageId, next);
}

/** Persist vote change; callers update React state for UI. */
export function persistResponseFeedbackVote(
  conversationId: string | null,
  messageId: string,
  next: "down" | "up" | null
): void {
  if (next === null) {
    if (conversationId) setFeedback(conversationId, messageId, null);
    return;
  }
  if (next === "up") {
    if (conversationId) setFeedback(conversationId, messageId, { vote: "up", at: Date.now() });
    return;
  }
  if (!conversationId) return;
  const prev = getFeedback(conversationId, messageId);
  setFeedback(conversationId, messageId, {
    vote: "down",
    at: Date.now(),
    reasonTag: prev?.vote === "down" ? prev.reasonTag : undefined,
    note: prev?.vote === "down" ? prev.note : undefined,
  });
}
