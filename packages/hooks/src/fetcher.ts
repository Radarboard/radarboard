/** Shared fetch function for SWR. Throws on non-OK responses. */
export async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Build a URL with query parameters, omitting null/undefined values. */
export function buildUrl(base: string, params: Record<string, string | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) searchParams.set(key, value);
  }
  const qs = searchParams.toString();
  return qs ? `${base}?${qs}` : base;
}
