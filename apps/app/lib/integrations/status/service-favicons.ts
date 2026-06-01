function getHostnameFromUrl(value: string | null | undefined): string {
  if (!value) return "";

  try {
    const url = value.includes("://") ? value : `https://${value}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Returns a Google Favicon API URL for an integration-owned homepage or docs URL.
 */
export function getServiceFaviconUrl(serviceUrl: string | null | undefined, size = 16): string {
  const domain = getHostnameFromUrl(serviceUrl);
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
