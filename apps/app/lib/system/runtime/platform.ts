/* biome-ignore-all lint/style/useNamingConvention: Tauri injects a non-camelCase global key. */
/**
 * Returns true when running inside the Tauri desktop shell.
 * Safe to call during SSR (returns false).
 */
export function isTauri(): boolean {
  const windowWithTauri = window as Window & { __TAURI_INTERNALS__?: unknown };
  return typeof window !== "undefined" && Boolean(windowWithTauri.__TAURI_INTERNALS__);
}
