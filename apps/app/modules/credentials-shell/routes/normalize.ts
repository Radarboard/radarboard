const BEARER_PREFIX = /^Bearer(?:\s+|$)/i;

export function normalizeCredentialValues(key: string, values: Record<string, string>) {
  if (key !== "raindrop") return values;

  const accessToken = values.accessToken;
  if (accessToken == null) return values;

  return {
    ...values,
    accessToken: accessToken.trim().replace(BEARER_PREFIX, "").trim(),
  };
}
