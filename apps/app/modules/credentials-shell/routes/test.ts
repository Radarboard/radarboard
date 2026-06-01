import "@/lib/integrations-init";

import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";
import { normalizeCredentialValues } from "./normalize";

const log = createLogger("api/credentials/test");
const RAINDROP_INVALID_TOKEN_MESSAGE =
  "Raindrop returned 401. Use a Test token from Raindrop App Management or a fresh OAuth access token. Client IDs, client secrets, and expired OAuth tokens are rejected.";

const SERVICE_TESTS: Record<
  string,
  (values: Record<string, string>) => Promise<{ ok: boolean; error?: string }>
> = {
  sentry: async (values) => {
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${values.authToken}`);
    const res = await fetch(`https://sentry.io/api/0/organizations/${values.orgSlug}/`, {
      headers,
    });
    return res.ok ? { ok: true } : { ok: false, error: `Sentry returned ${res.status}` };
  },
  openpanel: async (values) => {
    const res = await fetch("https://api.openpanel.dev/manage/projects", {
      headers: {
        "openpanel-client-id": values.clientId ?? "",
        "openpanel-client-secret": values.clientSecret ?? "",
      },
    });
    if (res.ok) return { ok: true };

    if (res.status === 401) {
      return {
        ok: false,
        error:
          "OpenPanel rejected the credentials. Radarboard needs a root client for this connection test.",
      };
    }

    return { ok: false, error: `OpenPanel returned ${res.status}` };
  },
  linear: async (values) => {
    const headers = new Headers({
      "Content-Type": "application/json",
    });
    headers.set("Authorization", values.apiKey ?? "");
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "{ viewer { id } }" }),
    });
    return res.ok ? { ok: true } : { ok: false, error: `Linear returned ${res.status}` };
  },
  raindrop: async (values) => {
    if (!values.accessToken?.trim()) {
      return { ok: false, error: "Add a Raindrop access token before testing the connection." };
    }
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${values.accessToken}`);
    const res = await fetch("https://api.raindrop.io/rest/v1/user", {
      headers,
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, error: RAINDROP_INVALID_TOKEN_MESSAGE };
    return { ok: false, error: `Raindrop returned ${res.status}` };
  },
  vercel: async (values) => {
    const url = values.teamId
      ? `https://api.vercel.com/v9/projects?teamId=${values.teamId}&limit=1`
      : "https://api.vercel.com/v9/projects?limit=1";
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${values.token}`);
    const res = await fetch(url, {
      headers,
    });
    return res.ok ? { ok: true } : { ok: false, error: `Vercel returned ${res.status}` };
  },
  opencollective: async (values) => {
    const res = await fetch("https://api.opencollective.com/graphql/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Personal-Token": values.apiToken ?? "",
      },
      body: JSON.stringify({ query: "{ me { id } }" }),
    });
    return res.ok ? { ok: true } : { ok: false, error: `Open Collective returned ${res.status}` };
  },
  betterstack: async (values) => {
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${values.apiToken}`);
    const res = await fetch("https://uptime.betterstack.com/api/v2/monitors?per_page=1", {
      headers,
    });
    return res.ok ? { ok: true } : { ok: false, error: `BetterStack returned ${res.status}` };
  },
  npm: async (values) => {
    const hasExtraPackages = (values.extraPackages?.trim().length ?? 0) > 0;
    if (!hasExtraPackages) {
      return { ok: false, error: "Add at least one package. Scope alone is not enough." };
    }
    return { ok: true };
  },
  "app-store-connect": async () => {
    return { ok: true };
  },
};

function getRegisteredCredentialTest(key: string) {
  for (const integration of getAllIntegrations()) {
    if (integration.id !== key && integration.auth.id !== key) continue;
    if (integration.auth.credentialTest) return integration.auth.credentialTest;
  }
  return null;
}
const testCredentialsSchema = z.object({
  key: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().min(1, "Missing key")
  ),
  values: z.preprocess(
    (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : undefined),
    z.record(z.string(), z.string())
  ),
});

export async function handleTestCredentials(request: Request) {
  try {
    const parsed = await parseBody(request, testCredentialsSchema);
    if (!parsed.ok) {
      const body = (await parsed.response.json().catch(() => ({ error: "Invalid request" }))) as {
        error?: string;
      };
      return errorJson(400, body.error ?? "Invalid request", { ok: false });
    }
    const body = parsed.data;

    const testFn = SERVICE_TESTS[body.key] ?? getRegisteredCredentialTest(body.key);
    if (!testFn) {
      return errorJson(404, `No test available for "${body.key}"`, { ok: false });
    }

    const result = await testFn(normalizeCredentialValues(body.key, body.values));
    return NextResponse.json(result);
  } catch (err) {
    log.error("Credential connection test failed", { error: err });
    return errorJson(500, err instanceof Error ? err.message : "Connection test failed", {
      ok: false,
    });
  }
}
