const DEFAULT_BROKER_URL = "https://auth.radarboard.app";

function requireEnv(name: string): string {
  // biome-ignore lint/style/noProcessEnv: This is the broker's centralized runtime env boundary.
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function getBrokerUrl(): string {
  // biome-ignore lint/style/noProcessEnv: This is the broker's centralized runtime env boundary.
  return (process.env.RADARBOARD_OAUTH_BROKER_URL ?? DEFAULT_BROKER_URL).replace(/\/+$/u, "");
}

export function getGoogleClientCredentials() {
  return {
    clientId: requireEnv("OAUTH_GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("OAUTH_GOOGLE_CLIENT_SECRET"),
  };
}

export function getTursoConfig() {
  return {
    url: requireEnv("TURSO_DATABASE_URL"),
    authToken: requireEnv("TURSO_AUTH_TOKEN"),
  };
}

export function getEncryptionKey(): string {
  return requireEnv("ENCRYPTION_KEY");
}
