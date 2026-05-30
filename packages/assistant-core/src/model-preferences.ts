const ENABLED_MODELS_STORAGE_KEY = "radarboard:enabled-models";

export function readEnabledModels(): Record<string, string[]> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ENABLED_MODELS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : null;
  } catch {
    return null;
  }
}

export function writeEnabledModels(data: Record<string, string[]>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ENABLED_MODELS_STORAGE_KEY, JSON.stringify(data));
}

export function getEnabledModelsForProvider(providerId: string): string[] | null {
  const data = readEnabledModels();
  if (!data) return null;
  return data[providerId] ?? null;
}
