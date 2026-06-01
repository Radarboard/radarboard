/** Server-side OAuth provider configuration. */
export interface OAuthProviderConfig {
  authorizationUrl: string;
  tokenUrl: string;
  tokenMapping: {
    accessTokenField: string;
    refreshTokenField?: string;
  };
  /** Additional params for the authorization URL (e.g., access_type=offline for Google). */
  authParams?: Record<string, string>;
  /**
   * Whether to normalize *.localhost subdomains to plain localhost in the redirect URI.
   * Keep this false for providers used through portless unless the app is also
   * reachable at plain localhost, because OAuth state cookies and callbacks
   * must share the same host.
   */
  normalizeOrigin?: boolean;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  github: {
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    tokenMapping: { accessTokenField: "access_token" },
    normalizeOrigin: false,
  },
  google: {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    tokenMapping: {
      accessTokenField: "access_token",
      refreshTokenField: "refresh_token",
    },
    authParams: {
      // biome-ignore lint/style/useNamingConvention: Google OAuth requires snake_case params
      access_type: "offline",
      prompt: "consent",
    },
    normalizeOrigin: false,
  },
};
