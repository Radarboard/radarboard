"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type TemplateFilterValue =
  | string
  | boolean
  | {
      min: number;
      max: number;
      enabled: boolean;
    };

export type TemplateFilterState = Record<string, TemplateFilterValue>;

interface FilterStateContextValue {
  states: Record<string, TemplateFilterState>;
  setState: (
    stateId: string,
    next: TemplateFilterState | ((current: TemplateFilterState | undefined) => TemplateFilterState)
  ) => void;
}

const FilterStateContext = createContext<FilterStateContextValue>({
  states: {},
  setState: () => {
    // default context placeholder
  },
});

export function TemplateFilterStateProvider({ children }: { children: ReactNode }) {
  const [states, setStates] = useState<Record<string, TemplateFilterState>>({});

  const value = useMemo<FilterStateContextValue>(
    () => ({
      states,
      setState: (stateId, next) => {
        setStates((current) => ({
          ...current,
          [stateId]: typeof next === "function" ? next(current[stateId]) : next,
        }));
      },
    }),
    [states]
  );

  return <FilterStateContext.Provider value={value}>{children}</FilterStateContext.Provider>;
}

function readPersistedFilterState(persistKey: string): TemplateFilterState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(persistKey);
    return raw ? (JSON.parse(raw) as TemplateFilterState) : null;
  } catch {
    return null;
  }
}

function writePersistedFilterState(persistKey: string, state: TemplateFilterState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(persistKey, JSON.stringify(state));
    window.dispatchEvent(
      new CustomEvent("template-filter-state-change", {
        detail: { persistKey, state },
      })
    );
  } catch {
    /* ignore */
  }
}

export function useTemplateFilterState(
  stateId: string,
  defaultState: TemplateFilterState,
  persistKey?: string
) {
  const { states, setState } = useContext(FilterStateContext);
  const persistedState = persistKey ? readPersistedFilterState(persistKey) : null;
  const state = states[stateId] ?? persistedState ?? defaultState;

  useEffect(() => {
    if (states[stateId]) return;
    setState(stateId, persistedState ?? defaultState);
  }, [defaultState, persistedState, setState, stateId, states]);

  useEffect(() => {
    if (!persistKey) return;
    writePersistedFilterState(persistKey, state);
  }, [persistKey, state]);

  const updateState = (
    next: TemplateFilterState | ((current: TemplateFilterState) => TemplateFilterState)
  ) => {
    setState(stateId, (current) =>
      typeof next === "function" ? next(current ?? defaultState) : next
    );
  };

  const resetState = () => {
    setState(stateId, defaultState);
  };

  return { state, updateState, resetState };
}
