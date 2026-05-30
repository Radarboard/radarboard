/**
 * OAuth provider configurations for LLM providers.
 *
 * Each provider that supports OAuth has its endpoints and scopes defined here.
 * The flow is: initiate → redirect to provider → callback → exchange code for token.
 */

export interface OAuthProviderConfig {
  /** LLM provider ID (must match @radarboard/llm provider ID). */
  providerId: string;
  /** Human-readable name. */
  name: string;
  /** OAuth authorization endpoint. */
  authorizationEndpoint: string;
  /** OAuth token endpoint. */
  tokenEndpoint: string;
  /** OAuth revocation endpoint (optional). */
  revocationEndpoint?: string;
  /** Dynamic client registration endpoint (optional, Anthropic supports this). */
  registrationEndpoint?: string;
  /** OAuth scopes to request. */
  scopes: string[];
  /** Code challenge method. */
  codeChallengeMethod: "S256" | "plain";
  /** Whether this provider uses dynamic client registration (no pre-registered client_id). */
  dynamicRegistration: boolean;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  openai: {
    providerId: "openai",
    name: "OpenAI",
    authorizationEndpoint: "https://auth.openai.com/authorize",
    tokenEndpoint: "https://auth0.openai.com/oauth/token",
    revocationEndpoint: "https://auth0.openai.com/oauth/revoke",
    scopes: ["openid", "profile", "email", "offline_access"],
    codeChallengeMethod: "S256",
    dynamicRegistration: false,
  },
};

/** Get OAuth config for a provider, or null if it doesn't support OAuth. */
export function getOAuthProvider(providerId: string): OAuthProviderConfig | null {
  return OAUTH_PROVIDERS[providerId] ?? null;
}

/** List all providers that support OAuth. */
export function listOAuthProviders(): OAuthProviderConfig[] {
  return Object.values(OAUTH_PROVIDERS);
}
