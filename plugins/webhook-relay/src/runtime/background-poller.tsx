"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { useEffect, useRef } from "react";

const POLL_INTERVAL_MS = 15_000;
const UNCONFIGURED_RETRY_MS = 60_000; // retry once/min when not configured

interface PollResponse {
  configured: boolean;
  relayTimestamp?: number;
}

/** Perform a single poll cycle and return the next interval to use. */
async function doPoll(sinceMs: number): Promise<{ nextInterval: number; nextTimestamp: number }> {
  const res = await fetch(API_ROUTES.relayPoll, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ since: sinceMs }),
  });

  if (!res.ok) return { nextInterval: POLL_INTERVAL_MS, nextTimestamp: sinceMs };

  const data = (await res.json()) as PollResponse;

  if (!data.configured) {
    return { nextInterval: UNCONFIGURED_RETRY_MS, nextTimestamp: sinceMs };
  }

  return {
    nextInterval: POLL_INTERVAL_MS,
    nextTimestamp: data.relayTimestamp ?? sinceMs,
  };
}

/**
 * Background poller that triggers server-side relay polling every 15s.
 *
 * Renders nothing. The actual relay fetch + notification emit happens
 * server-side in `/api/relay/poll` — this component just drives the
 * interval and tracks the cursor timestamp.
 *
 * When the relay is not configured, retries once per minute instead of
 * stopping permanently — so if the user adds the relay URL in settings,
 * polling starts without a page refresh.
 */
export function WebhookRelayPoller() {
  const lastTimestampRef = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    async function poll() {
      try {
        const result = await doPoll(lastTimestampRef.current);
        lastTimestampRef.current = result.nextTimestamp;

        if (!cancelled) {
          timeoutId = window.setTimeout(
            () =>
              poll().catch(() => {
                /* fire-and-forget */
              }),
            result.nextInterval
          );
        }
      } catch {
        // Network error — retry on next cycle
        if (!cancelled) {
          timeoutId = window.setTimeout(
            () =>
              poll().catch(() => {
                /* fire-and-forget */
              }),
            POLL_INTERVAL_MS
          );
        }
      }
    }

    poll().catch(() => {
      /* fire-and-forget */
    });

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return null;
}
