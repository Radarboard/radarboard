import type { PlatformType } from "@radarboard/types/project";

function normalizeInputUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    if (trimmed.includes(".") && !trimmed.includes(" ")) {
      return `https://${trimmed.replace(/^https?:\/\//, "")}`;
    }
    return "";
  }
}

export function inferHealthCheckBaseUrl(
  platformType: PlatformType,
  platformName: string,
  currentValue?: string
): string | null {
  const normalizedCurrent = currentValue ? normalizeInputUrl(currentValue) : "";
  if (normalizedCurrent) return normalizedCurrent;

  if (platformType !== "website" && platformType !== "web_app") return null;
  const inferred = normalizeInputUrl(platformName);
  return inferred || null;
}

export function buildHealthCheckSuggestions(
  platformType: PlatformType,
  platformName: string,
  currentValue?: string
): string[] {
  const baseUrl = inferHealthCheckBaseUrl(platformType, platformName, currentValue);
  if (!baseUrl) return [];

  if (platformType === "web_app") {
    return [`${baseUrl}/api/health`, baseUrl, `${baseUrl}/health`];
  }

  return [baseUrl, `${baseUrl}/api/health`, `${baseUrl}/health`];
}
