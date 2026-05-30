"use client";

import { useEffect, useRef } from "react";

interface UsePollingOptions {
  interval: number;
  enabled?: boolean;
}

export function usePolling(callback: () => void, options: UsePollingOptions): void {
  const { interval, enabled = true } = options;
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => savedCallback.current();
    const id = setInterval(tick, interval);

    return () => clearInterval(id);
  }, [interval, enabled]);
}
