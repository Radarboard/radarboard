/**
 * Assistant action: discover how a given service could be connected.
 *
 * Read-only. Aggregates candidates across the four "rungs" of the setup ladder:
 *   1. `registered` — a built-in or user-defined integration already in the registry
 *   2. `mcp`        — a known MCP server for the service
 *   3. `community`  — an installable community extension from the catalog
 *   4. `rest`       — always available: scaffold a no-code REST integration
 *
 * The planner (plan_integration_setup) consumes this to propose the best rung.
 */
import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { findKnownMcpServers, type KnownMcpServer } from "@/lib/integrations/known-mcp-servers";

export type IntegrationRung = "registered" | "mcp" | "community" | "rest";

export interface RegisteredOption {
  rung: "registered";
  id: string;
  name: string;
  description: string;
  authType: "api_key" | "oauth" | "none";
  /** Whether a credential is already stored for this integration's provider. */
  connected: boolean;
}

export interface McpOption {
  rung: "mcp";
  service: string;
  name: string;
  description: string;
  url?: string;
  docsUrl?: string;
  requiresAuth: boolean;
  authHint?: string;
}

export interface CommunityOption {
  rung: "community";
  id: string;
  name: string;
  description: string;
  installUrl?: string;
  repoUrl?: string;
}

export interface RestOption {
  rung: "rest";
  hint: string;
}

export type IntegrationOption = RegisteredOption | McpOption | CommunityOption | RestOption;

export interface FindOptionsResult {
  service: string;
  options: IntegrationOption[];
  /** Best rung to try first, given what's available (desktop-safe order). */
  recommendedRung: IntegrationRung;
}

const NORMALIZE = /[^a-z0-9]+/g;
const normalize = (value: string): string => value.toLowerCase().replace(NORMALIZE, "");

/** Case/punctuation-insensitive two-way substring match against any token. */
function matches(query: string, ...tokens: string[]): boolean {
  const q = normalize(query);
  if (!q) return false;
  return tokens.map(normalize).some((t) => t.length > 0 && (t.includes(q) || q.includes(t)));
}

async function findRegisteredOptions(service: string): Promise<RegisteredOption[]> {
  const { getCredentialRepo } = await import("@/data/core/repository");
  const repo = getCredentialRepo();
  const results: RegisteredOption[] = [];
  for (const descriptor of getAllIntegrations()) {
    if (!matches(service, descriptor.id, descriptor.name, descriptor.description)) continue;
    const { auth } = descriptor;
    let connected = auth.type === "none";
    if (!connected) {
      const key = auth.provider ?? auth.id;
      const stored = await repo.getCredential(key).catch(() => null);
      connected = stored != null && Object.keys(stored).length > 0;
    }
    results.push({
      rung: "registered",
      id: descriptor.id,
      name: descriptor.name,
      description: descriptor.description,
      authType: auth.type,
      connected,
    });
  }
  return results;
}

function toMcpOption(entry: KnownMcpServer): McpOption {
  return {
    rung: "mcp",
    service: entry.service,
    name: entry.name,
    description: entry.description,
    url: entry.url,
    docsUrl: entry.docsUrl,
    requiresAuth: entry.requiresAuth,
    authHint: entry.authHint,
  };
}

async function findCommunityOptions(
  service: string,
  registeredIds: Set<string>
): Promise<CommunityOption[]> {
  try {
    const { getExtensionCatalog } = await import("@/modules/extensions-shell/routes/catalog");
    const catalog = await getExtensionCatalog();
    return catalog.extensions
      .filter(
        (ext) =>
          ext.type === "integration" &&
          ext.installable &&
          !ext.installed &&
          !registeredIds.has(ext.id) &&
          matches(service, ext.id, ext.name, ext.description, ...(ext.tags ?? []))
      )
      .map((ext) => ({
        rung: "community" as const,
        id: ext.id,
        name: ext.name,
        description: ext.description,
        installUrl: ext.installUrl,
        repoUrl: ext.repoUrl,
      }));
  } catch {
    return [];
  }
}

function pickRecommendedRung(options: IntegrationOption[]): IntegrationRung {
  // Desktop-safe priority: an already-connected integration, then any registered
  // one, then a known MCP server, then an installable community extension, else
  // fall back to scaffolding a no-code REST integration.
  if (options.some((o) => o.rung === "registered" && o.connected)) return "registered";
  if (options.some((o) => o.rung === "registered")) return "registered";
  if (options.some((o) => o.rung === "mcp")) return "mcp";
  if (options.some((o) => o.rung === "community")) return "community";
  return "rest";
}

export async function executeFindOptions(params: { service: string }): Promise<FindOptionsResult> {
  const service = params.service.trim();
  const registered = await findRegisteredOptions(service);
  const registeredIds = new Set(registered.map((r) => r.id));
  const mcp = findKnownMcpServers(service).map(toMcpOption);
  const community = await findCommunityOptions(service, registeredIds);
  const rest: RestOption = {
    rung: "rest",
    hint: `Scaffold a no-code REST integration against the ${service} API (create_rest_integration).`,
  };

  const options: IntegrationOption[] = [...registered, ...mcp, ...community, rest];
  return { service, options, recommendedRung: pickRecommendedRung(options) };
}
