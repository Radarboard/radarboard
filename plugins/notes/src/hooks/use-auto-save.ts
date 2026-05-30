"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions {
  /** Debounce delay in ms (default 1500) */
  delay?: number;
  /** Called with the latest value when the debounce fires */
  onSave: (value: string) => Promise<void>;
  /** Called once before the first save of a session — used for snapshots */
  onBeforeFirstSave?: () => void;
}

/**
 * Debounced auto-save hook.
 *
 * Returns a `handleChange` callback that the editor should call on every
 * keystroke, plus the current save status for UI display.
 *
 * The save fires `delay` ms after the last change. On blur or unmount the
 * pending save is flushed immediately.
 */
export function useAutoSave({ delay = 1500, onSave, onBeforeFirstSave }: UseAutoSaveOptions) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<string | null>(null);
  const hasSavedRef = useRef(false);
  const savingRef = useRef(false);

  // Keep callbacks fresh without restarting timers
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onBeforeFirstSaveRef = useRef(onBeforeFirstSave);
  onBeforeFirstSaveRef.current = onBeforeFirstSave;

  const doSave = useCallback(async () => {
    const value = latestRef.current;
    if (value === null || savingRef.current) return;

    if (!hasSavedRef.current) {
      onBeforeFirstSaveRef.current?.();
      hasSavedRef.current = true;
    }

    savingRef.current = true;
    setStatus("saving");
    try {
      await onSaveRef.current(value);
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      savingRef.current = false;
      latestRef.current = null;
    }
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      latestRef.current = value;
      setStatus("idle");

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        doSave().catch(() => {
          /* fire-and-forget */
        });
      }, delay);
    },
    [delay, doSave]
  );

  /** Flush any pending save immediately (call on blur / mode switch). */
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    doSave().catch(() => {
      /* fire-and-forget */
    });
  }, [doSave]);

  /** Reset internal state when switching notes. */
  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    latestRef.current = null;
    hasSavedRef.current = false;
    setStatus("idle");
  }, []);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Fire a synchronous best-effort save (won't await)
      if (latestRef.current !== null)
        doSave().catch(() => {
          /* fire-and-forget */
        });
    };
  }, [doSave]);

  return { status, handleChange, flush, reset };
}
