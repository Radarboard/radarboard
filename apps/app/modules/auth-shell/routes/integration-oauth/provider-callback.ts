/* biome-ignore-all lint/style/useNamingConvention: OAuth token exchange fields intentionally use snake_case keys. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo } from "@/db/repository";
import { parseSearchParams } from "@/lib/api";
import { OAUTH_PROVIDERS, type OAuthProviderConfig } from "@/lib/auth/oauth-providers";
import { persistBrokerHandoffCredential, resolveBrokerGoogleClientCredentials } from "./broker";

const providerCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export function buildIntegrationSettingsRedirectUrl({
  origin,
  provider,
  status,
  credKey,
  error,
}: {
  origin: string;
  provider: string;
  status: "success" | "error";
  credKey?: string | null;
  error?: string;
}) {
  const redirectUrl = new URL("/", origin);
  redirectUrl.searchParams.set("settings", "integrations");
  redirectUrl.searchParams.set("integrationTab", "access");
  redirectUrl.searchParams.set("oauth", status);
  redirectUrl.searchParams.set("provider", provider);
  if (credKey) {
    redirectUrl.searchParams.set("service", credKey);
  }
  if (status === "error" && error) {
    redirectUrl.searchParams.set("error", error);
  }
  return redirectUrl.toString();
}

async function readRedirectCredentialKey() {
  const cookieStore = await cookies();
  return cookieStore.get("oauth_cred_key")?.value ?? null;
}

async function errorRedirect(origin: string, provider: string, error: string) {
  const credKey = await readRedirectCredentialKey();
  return NextResponse.redirect(
    buildIntegrationSettingsRedirectUrl({
      origin,
      provider,
      status: "error",
      credKey,
      error,
    })
  );
}

async function exchangeCodeForTokens(
  providerConfig: OAuthProviderConfig,
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken?: string; refreshToken?: string; error?: string }> {
  const tokenRes = await fetch(providerConfig.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text();
    return { error: `Token exchange failed: ${errorBody}` };
  }

  const tokenData = (await tokenRes.json()) as Record<string, unknown>;
  const { tokenMapping } = providerConfig;

  return {
    accessToken: tokenData[tokenMapping.accessTokenField] as string | undefined,
    refreshToken: tokenMapping.refreshTokenField
      ? (tokenData[tokenMapping.refreshTokenField] as string | undefined)
      : undefined,
  };
}

async function resolveOrigin(request: Request): Promise<string> {
  const cookieStore = await cookies();
  const storedOrigin = cookieStore.get("oauth_origin")?.value;
  if (storedOrigin) return storedOrigin;

  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const hostHeader = forwardedHost ?? request.headers.get("host");
  return hostHeader ? `${forwardedProto}://${hostHeader}` : url.origin;
}

async function validateCallbackParams(
  request: Request,
  origin: string,
  provider: string
): Promise<{ code: string; state: string } | { error: NextResponse<unknown> }> {
  const parsed = parseSearchParams(new URL(request.url).searchParams, providerCallbackQuerySchema);
  if (!parsed.ok) {
    return { error: await errorRedirect(origin, provider, "Invalid callback parameters") };
  }
  const { code, state, error: providerError, error_description } = parsed.data;

  if (providerError) {
    return {
      error: await errorRedirect(origin, provider, error_description ?? providerError),
    };
  }

  if (!code || !state) {
    return { error: await errorRedirect(origin, provider, "Missing code or state") };
  }

  return { code, state };
}

async function validateCsrfAndCredentials(
  state: string,
  origin: string,
  provider: string
): Promise<
  | {
      credKey: string;
      existingCreds: Record<string, string> & { clientId: string; clientSecret: string };
    }
  | { error: NextResponse<unknown> }
> {
  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  const credKey = cookieStore.get("oauth_cred_key")?.value;

  if (!storedState || state !== storedState) {
    return { error: await errorRedirect(origin, provider, "Invalid state (CSRF check failed)") };
  }

  if (!credKey) {
    return { error: await errorRedirect(origin, provider, "Missing credential key") };
  }

  const repo = getCredentialRepo();
  const existingCreds = await repo.getCredential(credKey);
  const brokerGoogleCreds =
    provider === "google" ? await resolveBrokerGoogleClientCredentials(credKey) : null;

  if (!brokerGoogleCreds && (!existingCreds?.clientId || !existingCreds?.clientSecret)) {
    return { error: await errorRedirect(origin, provider, "Client credentials not found") };
  }

  return {
    credKey,
    existingCreds: {
      ...(existingCreds ?? {}),
      ...(brokerGoogleCreds ?? {}),
    } as Record<string, string> & {
      clientId: string;
      clientSecret: string;
    },
  };
}

export async function handleIntegrationProviderCallback(request: Request, provider: string) {
  const providerConfig = OAUTH_PROVIDERS[provider];

  const origin = await resolveOrigin(request);

  if (!providerConfig) {
    return errorRedirect(origin, provider, "Unknown provider");
  }

  const callbackParams = await validateCallbackParams(request, origin, provider);
  if ("error" in callbackParams) return callbackParams.error;
  const { code, state } = callbackParams;

  const csrfResult = await validateCsrfAndCredentials(state, origin, provider);
  if ("error" in csrfResult) return csrfResult.error;
  const { credKey, existingCreds } = csrfResult;

  const redirectUri = `${origin}/api/auth/${provider}/callback`;
  const tokens = await exchangeCodeForTokens(
    providerConfig,
    code,
    existingCreds.clientId,
    existingCreds.clientSecret,
    redirectUri
  );

  if (tokens.error) {
    return errorRedirect(origin, provider, tokens.error);
  }

  if (!tokens.accessToken && !tokens.refreshToken) {
    return errorRedirect(origin, provider, "No token in response");
  }

  const cookieStore = await cookies();
  const handoffId = cookieStore.get("oauth_broker_handoff_id")?.value;
  const handoffChallenge = cookieStore.get("oauth_broker_challenge")?.value;
  const handoffReturnOrigin = cookieStore.get("oauth_broker_return_origin")?.value;

  if (handoffId && handoffChallenge && handoffReturnOrigin && tokens.refreshToken) {
    await persistBrokerHandoffCredential({
      handoffId,
      challenge: handoffChallenge,
      returnOrigin: handoffReturnOrigin,
      provider,
      credKey,
      clientId: existingCreds.clientId,
      clientSecret: existingCreds.clientSecret,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
    });

    cookieStore.delete("oauth_state");
    cookieStore.delete("oauth_cred_key");
    cookieStore.delete("oauth_origin");
    cookieStore.delete("oauth_broker_handoff_id");
    cookieStore.delete("oauth_broker_challenge");
    cookieStore.delete("oauth_broker_return_origin");

    const brokerCallbackUrl = new URL(`/api/auth/broker/${provider}/callback`, origin);
    brokerCallbackUrl.searchParams.set("handoffId", handoffId);
    return NextResponse.redirect(brokerCallbackUrl.toString());
  }

  const mergedCreds = { ...existingCreds };
  if (tokens.accessToken) mergedCreds.token = tokens.accessToken;
  if (tokens.refreshToken) mergedCreds.refreshToken = tokens.refreshToken;

  const repo = getCredentialRepo();
  await repo.setCredential(credKey, mergedCreds);

  cookieStore.delete("oauth_state");
  cookieStore.delete("oauth_cred_key");
  cookieStore.delete("oauth_origin");

  return NextResponse.redirect(
    buildIntegrationSettingsRedirectUrl({
      origin,
      provider,
      status: "success",
      credKey,
    })
  );
}
