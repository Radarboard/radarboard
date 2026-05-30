import { useState } from "react";

export function parseAsStringLiteral<TValues extends readonly string[]>(_values: TValues) {
  return {
    parse: (value: string | null) => value,
  };
}

export function parseAsString(value: string | null) {
  return value;
}

export function useQueryState<TValue = string | null>(
  _key: string,
  _parser?: unknown
): [TValue | null, (value: TValue | null) => void] {
  const [value, setValue] = useState<TValue | null>(null);
  return [value, setValue];
}
