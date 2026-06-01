type BrokerCredential = Record<string, string>;

type BrokerAccessTokenResponse = {
  accessToken?: string;
};

type OAuthBrokerCredential = BrokerCredential & {
  authMethod: "oauth_broker";
  brokerUrl: string;
  brokerCredentialToken: string;
};

export function isOAuthBrokerCredential(
  creds: Record<string, string> | null | undefined
): creds is OAuthBrokerCredential {
  return Boolean(
    creds?.authMethod === "oauth_broker" && creds.brokerUrl && creds.brokerCredentialToken
  );
}

export async function resolveOAuthBrokerAccessToken(
  provider: string,
  creds: BrokerCredential
): Promise<string | null> {
  if (!isOAuthBrokerCredential(creds)) return null;

  const brokerUrl = creds.brokerUrl.replace(/\/+$/u, "");
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  const response = await fetch(`${brokerUrl}/api/auth/broker/${provider}/access-token`, {
    method: "POST",
    headers,
    body: JSON.stringify({ brokerCredentialToken: creds.brokerCredentialToken }),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as BrokerAccessTokenResponse;
  return payload.accessToken ?? null;
}

export async function resolveGoogleSearchConsoleBrokerCredential(
  creds: BrokerCredential
): Promise<BrokerCredential | null> {
  const accessToken = await resolveOAuthBrokerAccessToken("google", creds);
  if (!accessToken) return null;

  return {
    ...creds,
    accessToken,
    token: accessToken,
  };
}
