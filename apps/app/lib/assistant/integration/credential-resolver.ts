import type { ASCConfig } from "@radarboard/integration-app-store-connect/types";
import type { BetterStackConfig } from "@radarboard/integration-betterstack/types";
import type { GitHubConfig } from "@radarboard/integration-github/types";
import type { LinearConfig } from "@radarboard/integration-linear/types";
import type { OpenCollectiveConfig } from "@radarboard/integration-open-collective/types";
import type { OpenPanelConfig } from "@radarboard/integration-openpanel/types";
import type { ResendConfig } from "@radarboard/integration-resend/types";
import type { RevenueCatConfig } from "@radarboard/integration-revenuecat/types";
import type { SentryConfig } from "@radarboard/integration-sentry/types";
import type { VercelConfig } from "@radarboard/integration-vercel/types";
import { getCredentialRepo } from "@/data/core/repository";

/**
 * Resolve credentials from the encrypted store.
 * Returns null if credentials are not configured.
 */
async function resolveCredential(key: string): Promise<Record<string, string> | null> {
  try {
    const repo = getCredentialRepo();
    const creds = await repo.getCredential(key);
    if (creds) return creds;
  } catch {
    // Credential store not available (e.g., DB not initialized yet)
  }
  return null;
}

// --- Per-service resolvers ---

/**
 * Resolves RevenueCat API credentials.
 *
 * `projectId` is resolved from the platform settings (project_integrations) at
 * each call site and passed in here. The credential store's `projectId` field
 * acts as a global fallback when no per-project override is set.
 */
export async function resolveRevenueCatConfig(
  projectId?: string
): Promise<RevenueCatConfig | null> {
  const creds = await resolveCredential("revenuecat");
  if (!creds?.apiKey) return null;
  const resolvedProjectId = projectId || creds.projectId;
  if (!resolvedProjectId) return null;
  return { apiKey: creds.apiKey, projectId: resolvedProjectId };
}

export async function resolveSentryConfig(): Promise<SentryConfig | null> {
  const creds = await resolveCredential("sentry");
  if (creds?.authToken && creds?.orgSlug) {
    return { authToken: creds.authToken, orgSlug: creds.orgSlug };
  }
  return null;
}

export async function resolveOpenPanelConfig(projectId: string): Promise<OpenPanelConfig | null> {
  const creds = await resolveCredential("openpanel");
  if (creds?.clientId && creds?.clientSecret) {
    return { clientId: creds.clientId, clientSecret: creds.clientSecret, projectId };
  }
  return null;
}

export async function resolveBetterStackConfig(): Promise<BetterStackConfig | null> {
  const creds = await resolveCredential("betterstack");
  if (creds?.apiToken) {
    return { apiToken: creds.apiToken };
  }
  return null;
}

export async function resolveOCConfig(slug: string): Promise<OpenCollectiveConfig | null> {
  const creds = await resolveCredential("opencollective");
  if (creds?.apiToken) {
    return { apiToken: creds.apiToken, slug };
  }
  return null;
}

export async function resolveLinearConfig(): Promise<LinearConfig | null> {
  const creds = await resolveCredential("linear");
  if (creds?.apiKey) {
    return { apiKey: creds.apiKey };
  }
  return null;
}

export async function resolveVercelConfig(): Promise<VercelConfig | null> {
  const creds = await resolveCredential("vercel");
  if (creds?.token) {
    return { token: creds.token, teamId: creds.teamId || undefined };
  }
  return null;
}

export async function resolveGitHubConfig(): Promise<GitHubConfig | null> {
  const creds = await resolveCredential("github");
  // Support PAT stored as "token", and legacy OAuth access token stored as "accessToken"
  const token = creds?.token ?? creds?.accessToken;
  if (token) {
    return { token };
  }
  return null;
}

export async function resolveASCConfig(): Promise<ASCConfig | null> {
  const creds = await resolveCredential("app-store-connect");
  if (creds?.keyId && creds?.issuerId && creds?.privateKey) {
    return {
      keyId: creds.keyId,
      issuerId: creds.issuerId,
      privateKey: creds.privateKey.replace(/\\n/g, "\n"),
    };
  }
  return null;
}

export async function resolveGSCConfig() {
  const creds = await resolveCredential("google-search-console");
  if (creds?.refreshToken && creds?.clientId && creds?.clientSecret) {
    return {
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      refreshToken: creds.refreshToken,
    };
  }
  return null;
}

export async function resolveResendConfig(): Promise<ResendConfig | null> {
  const creds = await resolveCredential("resend");
  if (creds?.apiKey && creds?.fromEmail && creds?.toEmail) {
    return { apiKey: creds.apiKey, fromEmail: creds.fromEmail, toEmail: creds.toEmail };
  }
  return null;
}
