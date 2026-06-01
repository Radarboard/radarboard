import type { DataSourceContext } from "@radarboard/integration-sdk/types";
import {
  getCredentialRepo,
  getGitHubStarHistoryRepo,
  getSettingsRepo,
} from "@/data/core/repository";
import {
  isOAuthBrokerCredential,
  resolveGoogleSearchConsoleBrokerCredential,
} from "@/lib/auth/oauth-broker-client";
import { getMcpClient } from "@/lib/mcp/mcp-client";
import { callNamedMcpToolJson, listNamedMcpTools } from "@/lib/mcp/named-mcp-client";
import { deriveAllProjects } from "@/lib/projects/derived-projects";

/**
 * Build the DataSourceContext that is injected into every data-source fetch function.
 * This bridges the gap between the integration packages (which cannot import from apps/app)
 * and the web app's credential/settings infrastructure.
 */
export function buildDataSourceContext(): DataSourceContext {
  return {
    async resolveCredential(key: string): Promise<Record<string, string> | null> {
      try {
        const repo = getCredentialRepo();
        const creds = await repo.getCredential(key);
        if (key === "google-search-console" && isOAuthBrokerCredential(creds)) {
          return await resolveGoogleSearchConsoleBrokerCredential(creds);
        }
        if (creds) return creds;
      } catch {
        // Credential store not available
      }
      return null;
    },

    async getProjectIntegrations() {
      try {
        const settingsRepo = getSettingsRepo();
        return await settingsRepo.getProjectIntegrations();
      } catch {
        return {};
      }
    },

    async getAllProjects() {
      const settingsRepo = getSettingsRepo();
      const projectIntegrations = await settingsRepo.getProjectIntegrations().catch(() => ({}));
      return deriveAllProjects(projectIntegrations) as unknown as Awaited<
        ReturnType<DataSourceContext["getAllProjects"]>
      >;
    },

    getMcpClient(url: string, authHeader?: string) {
      return getMcpClient(url, authHeader);
    },

    listMcpToolsByName(name: string) {
      return listNamedMcpTools(name);
    },

    callMcpToolJsonByName<T>(name: string, tool: string, args: Record<string, unknown>) {
      return callNamedMcpToolJson<T>(name, tool, args);
    },

    getGitHubStarHistoryRepo() {
      return getGitHubStarHistoryRepo();
    },
  };
}
