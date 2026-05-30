import { API_ROUTES } from "@radarboard/types/api-routes";

export type ChatFeedbackServerPayload =
  | {
      kind: "vote";
      conversationId: string | null;
      messageId: string;
      vote: "up" | "down" | null;
    }
  | {
      kind: "detail";
      conversationId: string | null;
      messageId: string;
      reasonTag?: string;
      note?: string;
    };

const MAX_NOTE_CHARS = 2_000;
const RETRY_DELAY_MS = 2_000;

/** Fire-and-forget POST to the web app with one retry; sessionStorage remains source of truth. */
export function submitChatResponseFeedbackToServer(payload: ChatFeedbackServerPayload): void {
  if (typeof window === "undefined") return;
  if (payload.kind === "detail") {
    const note = payload.note?.trim();
    const hasTag = Boolean(payload.reasonTag);
    if (!hasTag && !note) return;
    const trimmedPayload =
      note && note.length > MAX_NOTE_CHARS
        ? { ...payload, note: note.slice(0, MAX_NOTE_CHARS) }
        : { ...payload, note: note || undefined };
    postWithRetry(trimmedPayload);
    return;
  }
  postWithRetry(payload);
}

function postWithRetry(body: ChatFeedbackServerPayload): void {
  postFeedback(body).then(
    (ok) => {
      if (!ok) scheduleRetry(body);
    },
    () => scheduleRetry(body)
  );
}

function scheduleRetry(body: ChatFeedbackServerPayload): void {
  window.setTimeout(() => {
    postFeedback(body).catch(() => undefined);
  }, RETRY_DELAY_MS);
}

/** Returns `true` on success (2xx), `false` otherwise. */
function postFeedback(body: ChatFeedbackServerPayload): Promise<boolean> {
  return fetch(API_ROUTES.chatFeedback, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(
    (res) => res.ok,
    () => false
  );
}
