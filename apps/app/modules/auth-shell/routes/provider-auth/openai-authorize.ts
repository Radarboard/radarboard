import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import { getWebEnv, WEB_ENV_KEYS } from "@/lib/env";
import { generateCodeChallenge, generateCodeVerifier, generateState } from "@/lib/oauth/pkce";
import { getOAuthProvider } from "@/lib/oauth/providers";

export async function handleOpenAiOAuthAuthorize(request: Request) {
  const provider = getOAuthProvider("openai");
  if (!provider) {
    return errorJson(400, "OpenAI OAuth is not configured");
  }

  const clientId = getWebEnv(WEB_ENV_KEYS.oauth.openaiClientId) ?? "";
  const clientSecret = getWebEnv(WEB_ENV_KEYS.oauth.openaiClientSecret) ?? "";
  if (!clientId) {
    return errorJson(500, `Missing ${WEB_ENV_KEYS.oauth.openaiClientId} environment variable`);
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/provider-auth/openai/oauth/callback`;

  const cookieStore = await cookies();
  cookieStore.set(
    "provider_auth_state",
    JSON.stringify({
      providerId: "openai",
      codeVerifier,
      state,
      clientId,
      clientSecret,
      redirectUri,
    }),
    {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    }
  );

  const url = new URL(provider.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", provider.codeChallengeMethod);
  url.searchParams.set("scope", provider.scopes.join(" "));

  return NextResponse.json({ url: url.toString(), method: "auto" });
}
