"use client";

import { useEffect, useRef, useState } from "react";

export interface UseSSEOptions<T> {
  url: string;
  enabled?: boolean;
  onMessage?: (data: T) => void;
}

export interface UseSSEReturn<T> {
  data: T | null;
  error: Error | null;
  connected: boolean;
}

export function useSSE<T>({ url, enabled = true, onMessage }: UseSSEOptions<T>): UseSSEReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) return;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      const parsed = JSON.parse(event.data as string) as T;
      setData(parsed);
      onMessageRef.current?.(parsed);
    };

    es.onerror = () => {
      setConnected(false);
      setError(new Error("SSE connection failed"));
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [url, enabled]);

  return { data, error, connected };
}
