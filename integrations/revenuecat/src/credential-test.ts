const REVENUECAT_API_BASE = "https://api.revenuecat.com/v2";

type CredentialTestResult = { ok: boolean; error?: string };

function revenueCatProjectIdHint(projectId: string | undefined): string {
  if (projectId?.startsWith("app")) {
    return " This looks like a RevenueCat App ID. Use the Project ID from Project Settings instead.";
  }
  return "";
}

async function readRevenueCatError(response: Response): Promise<string | null> {
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
    type?: unknown;
  } | null;
  if (typeof body?.message === "string" && body.message.trim().length > 0) {
    return body.message.trim();
  }
  if (typeof body?.type === "string" && body.type.trim().length > 0) {
    return body.type.trim();
  }
  return null;
}

async function explainRevenueCatFailure(
  response: Response,
  endpointLabel: "Overview Configuration" | "Charts Configuration",
  projectId: string | undefined
): Promise<CredentialTestResult> {
  const upstreamMessage = await readRevenueCatError(response);
  const suffix = upstreamMessage ? ` RevenueCat said: ${upstreamMessage}` : "";

  if (response.status === 401) {
    return {
      ok: false,
      error:
        "RevenueCat rejected the API secret key. Use a valid V2 secret key that starts with sk_.",
    };
  }

  if (response.status === 403) {
    return {
      ok: false,
      error: `RevenueCat denied access. Set Charts metrics ${endpointLabel} to Read for this V2 secret key.${suffix}`,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: `RevenueCat could not find that project. Use the Project ID from RevenueCat Project Settings, not an App ID.${revenueCatProjectIdHint(projectId)}${suffix}`,
    };
  }

  return {
    ok: false,
    error: `RevenueCat returned ${response.status} while checking ${endpointLabel}.${suffix}`,
  };
}

async function testRevenueCatEndpoint(
  url: string,
  headers: Headers,
  endpointLabel: "Overview Configuration" | "Charts Configuration",
  projectId: string | undefined
): Promise<CredentialTestResult> {
  const response = await fetch(url, { headers });
  if (response.ok) return { ok: true };
  return explainRevenueCatFailure(response, endpointLabel, projectId);
}

export async function testRevenueCatCredentials(
  values: Record<string, string>
): Promise<CredentialTestResult> {
  const apiKey = values.apiKey?.trim();
  const projectId = values.projectId?.trim();
  if (!apiKey || !projectId) {
    return { ok: false, error: "RevenueCat API secret key and Project ID are required." };
  }

  if (apiKey.startsWith("appl_")) {
    return {
      ok: false,
      error:
        "RevenueCat public SDK keys start with appl_. Create a V2 secret API key that starts with sk_.",
    };
  }

  const encodedProjectId = encodeURIComponent(projectId);
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Content-Type", "application/json");

  const overviewResult = await testRevenueCatEndpoint(
    `${REVENUECAT_API_BASE}/projects/${encodedProjectId}/metrics/overview?currency=USD`,
    headers,
    "Overview Configuration",
    projectId
  );
  if (!overviewResult.ok) return overviewResult;

  return testRevenueCatEndpoint(
    `${REVENUECAT_API_BASE}/projects/${encodedProjectId}/charts/revenue?currency=USD&resolution=0`,
    headers,
    "Charts Configuration",
    projectId
  );
}
