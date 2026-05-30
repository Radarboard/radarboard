"use client";

import { pluginRoute } from "@radarboard/types/api-routes";
import { useEffect, useRef } from "react";
import useSWRMutation from "swr/mutation";

const DEFAULT_SYNC_INTERVAL_MS = 5 * 60 * 1000;

async function syncRss(_key: string, { arg }: { arg: { signal: AbortSignal } }) {
  const res = await fetch(pluginRoute("rss-reader", "sync"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emitNotifications: true }),
    signal: arg.signal,
  });
  return res.json();
}

export function RssReaderBackgroundPoller({ isDisabled = false }: { isDisabled?: boolean }) {
  const route = pluginRoute("rss-reader", "sync");
  const { trigger } = useSWRMutation(route, syncRss);
  const triggerRef = useRef(trigger);
  triggerRef.current = trigger;

  useEffect(() => {
    if (isDisabled) return;

    const controller = new AbortController();
    const { signal } = controller;
    let timeoutId: number | undefined;

    async function run() {
      try {
        await triggerRef.current({ signal });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }

      if (!signal.aborted) {
        timeoutId = window.setTimeout(() => {
          run().catch(() => {
            /* fire-and-forget */
          });
        }, DEFAULT_SYNC_INTERVAL_MS);
      }
    }

    run().catch(() => {
      /* fire-and-forget */
    });

    return () => {
      controller.abort();
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isDisabled]);

  return null;
}
