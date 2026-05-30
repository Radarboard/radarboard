/* biome-ignore-all lint/style/useNamingConvention: OAuth protocol fields intentionally use snake_case response keys. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseFormData, parseSearchParams } from "@/lib/api";
import {
  generateAuthCode,
  getAppUrl,
  getOAuthClient,
  isApproved,
  setApproved,
  signFormState,
  storeAuthCode,
  verifyFormState,
} from "@/lib/mcp-oauth";

const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const oauthAuthorizeQuerySchema = z.object({
  client_id: z.string().optional(),
  redirect_uri: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.string().optional(),
});
const oauthAuthorizeApprovalSchema = z.object({
  client_id: z.string().optional(),
  redirect_uri: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  csrf_sig: z.string().optional(),
  action: z.string().optional(),
});

async function issueCodeAndRedirect(
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge: string
): Promise<Response> {
  const code = generateAuthCode();
  await storeAuthCode(code, {
    clientId,
    redirectUri,
    codeChallenge,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS).toISOString(),
  });
  const params = new URLSearchParams({ code, state });
  return NextResponse.redirect(`${redirectUri}?${params.toString()}`);
}

function buildApprovalPage(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  csrfSig: string;
  appUrl: string;
}): string {
  const { clientId, redirectUri, state, codeChallenge, csrfSig, appUrl } = opts;
  const esc = (s: string) => s.replace(/"/g, "&quot;").replace(/</g, "&lt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize ChatGPT — Radarboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
           background: #0a0a0a; color: #e5e5e5; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; }
    .card { background: #111; border: 1px solid #222; border-radius: 12px;
            padding: 2rem; max-width: 420px; width: 100%; }
    h1 { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
    p  { font-size: 0.8rem; color: #888; margin-bottom: 1.5rem; line-height: 1.5; }
    .origin { font-size: 0.7rem; font-family: monospace; color: #555;
              background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 4px;
              padding: 0.4rem 0.6rem; margin-bottom: 1.5rem; word-break: break-all; }
    .actions { display: flex; gap: 0.75rem; }
    button { flex: 1; padding: 0.6rem 1rem; border-radius: 6px; font-size: 0.8rem;
             font-family: monospace; cursor: pointer; border: none; transition: opacity 0.15s; }
    button:hover { opacity: 0.85; }
    .allow  { background: #166534; color: #86efac; }
    .deny   { background: #1a1a1a; color: #888; border: 1px solid #333; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize ChatGPT</h1>
    <p>ChatGPT is requesting read access to your Radarboard dashboard data.</p>
    <div class="origin">${esc(appUrl)}</div>
    <form method="POST" action="/api/oauth/authorize">
      <input type="hidden" name="client_id"      value="${esc(clientId)}" />
      <input type="hidden" name="redirect_uri"   value="${esc(redirectUri)}" />
      <input type="hidden" name="state"          value="${esc(state)}" />
      <input type="hidden" name="code_challenge" value="${esc(codeChallenge)}" />
      <input type="hidden" name="csrf_sig"       value="${esc(csrfSig)}" />
      <div class="actions">
        <button type="submit" name="action" value="allow"  class="allow">Allow</button>
        <button type="submit" name="action" value="deny"   class="deny">Deny</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

export async function handleOAuthAuthorize(request: Request) {
  const parsed = parseSearchParams(new URL(request.url).searchParams, oauthAuthorizeQuerySchema);
  if (!parsed.ok) return parsed.response;
  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    state = "",
    code_challenge: codeChallenge = "",
    code_challenge_method: codeChallengeMethod,
  } = parsed.data;

  if (!clientId || !redirectUri) {
    return errorJson(400, "invalid_request");
  }
  if (codeChallengeMethod !== "S256") {
    return errorJson(400, "invalid_request", { error_description: "Only S256 PKCE is supported" });
  }

  const client = await getOAuthClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return errorJson(400, "invalid_client");
  }

  const approved = await isApproved();
  if (approved) {
    return issueCodeAndRedirect(clientId, redirectUri, state, codeChallenge);
  }

  const csrfSig = signFormState(state);
  const appUrl = getAppUrl();
  const html = buildApprovalPage({ clientId, redirectUri, state, codeChallenge, csrfSig, appUrl });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function handleOAuthAuthorizeApproval(request: Request) {
  const parsed = await parseFormData(request, oauthAuthorizeApprovalSchema);
  if (!parsed.ok) return errorJson(400, "invalid_request");
  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    state = "",
    code_challenge: codeChallenge = "",
    csrf_sig: csrfSig,
    action,
  } = parsed.data;

  if (!clientId || !redirectUri || !csrfSig) {
    return errorJson(400, "invalid_request");
  }

  if (!verifyFormState(state, csrfSig)) {
    return errorJson(400, "invalid_request", { error_description: "CSRF check failed" });
  }

  if (action === "deny") {
    const params = new URLSearchParams({ error: "access_denied", state });
    return NextResponse.redirect(`${redirectUri}?${params.toString()}`);
  }

  await setApproved();
  return issueCodeAndRedirect(clientId, redirectUri, state, codeChallenge);
}
