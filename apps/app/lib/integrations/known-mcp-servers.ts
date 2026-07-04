/**
 * Curated registry of services commonly reachable via an MCP server.
 *
 * This is a matching aid for the assistant's integration discovery: it maps a
 * user's service name (e.g. "sentry") to the hint that an MCP server exists and
 * what it needs. Endpoint URLs are intentionally NOT hard-coded — MCP endpoints
 * vary by deployment (cloud vs. self-hosted) and change over time, so the
 * planner asks the user to supply the exact URL rather than guessing one. Add
 * entries here as reliable public endpoints become known.
 */

/** A well-known service that offers an MCP server. */
export interface KnownMcpServer {
  /** Canonical service key, e.g. "sentry". */
  service: string;
  /** Alternate names/tokens used to match a user's request. */
  aliases: string[];
  /** Display name. */
  name: string;
  /** One-line description of what connecting unlocks. */
  description: string;
  /** Only streamable-http is offered to the assistant (stdio runs arbitrary commands). */
  transport: "streamable-http";
  /**
   * Publicly stable endpoint URL, if one is genuinely known. Usually omitted so
   * the planner collects it from the user (cloud vs. self-hosted differ).
   */
  url?: string;
  /** Docs URL for locating the endpoint / obtaining a token. */
  docsUrl?: string;
  /** Whether the server needs an Authorization header (assistant collects a token). */
  requiresAuth: boolean;
  /** Human hint about the credential to provide, e.g. "a Sentry auth token". */
  authHint?: string;
}

export const KNOWN_MCP_SERVERS: KnownMcpServer[] = [
  {
    service: "sentry",
    aliases: ["sentry", "sentry.io"],
    name: "Sentry",
    description: "Query issues, events, and releases from your Sentry org.",
    transport: "streamable-http",
    docsUrl: "https://docs.sentry.io/product/sentry-mcp/",
    requiresAuth: true,
    authHint: "a Sentry auth token (Bearer)",
  },
  {
    service: "github",
    aliases: ["github", "gh"],
    name: "GitHub",
    description: "Query repositories, issues, pull requests, and actions.",
    transport: "streamable-http",
    docsUrl: "https://github.com/github/github-mcp-server",
    requiresAuth: true,
    authHint: "a GitHub personal access token (Bearer)",
  },
  {
    service: "linear",
    aliases: ["linear", "linear.app"],
    name: "Linear",
    description: "Query issues, projects, and cycles from Linear.",
    transport: "streamable-http",
    docsUrl: "https://linear.app/docs/mcp",
    requiresAuth: true,
    authHint: "a Linear API key (Bearer)",
  },
  {
    service: "notion",
    aliases: ["notion", "notion.so"],
    name: "Notion",
    description: "Read and search Notion pages and databases.",
    transport: "streamable-http",
    docsUrl: "https://developers.notion.com/docs/mcp",
    requiresAuth: true,
    authHint: "a Notion integration token (Bearer)",
  },
  {
    service: "stripe",
    aliases: ["stripe"],
    name: "Stripe",
    description: "Query customers, charges, and subscriptions from Stripe.",
    transport: "streamable-http",
    docsUrl: "https://docs.stripe.com/mcp",
    requiresAuth: true,
    authHint: "a Stripe restricted API key (Bearer)",
  },
];

const NORMALIZE = /[^a-z0-9]+/g;

function normalize(value: string): string {
  return value.toLowerCase().replace(NORMALIZE, "");
}

/**
 * Find known MCP servers whose service key or aliases match the query.
 * Matching is normalized (case/punctuation-insensitive) and substring-based.
 */
export function findKnownMcpServers(query: string): KnownMcpServer[] {
  const q = normalize(query);
  if (!q) return [];
  return KNOWN_MCP_SERVERS.filter((entry) => {
    const tokens = [entry.service, ...entry.aliases].map(normalize);
    return tokens.some((token) => token.includes(q) || q.includes(token));
  });
}
