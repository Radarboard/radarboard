/**
 * Zod raw shapes for the integration "ladder" tools, exposed on Radarboard's MCP
 * server so external MCP clients can drive the same discover → plan → create →
 * visualize flow the in-app assistant uses. The handlers delegate to the exact
 * same executors (see app/api/mcp/tools.ts `dispatchTool`), so behavior is
 * shared even though the input shapes live here.
 */
import { z } from "zod";

export const findIntegrationOptionsShape = {
  service: z.string().describe("Service name to look up, e.g. 'stripe'"),
} as const;

export const planIntegrationSetupShape = {
  service: z.string().describe("Service the user wants to connect, e.g. 'sentry'"),
} as const;

export const createRestIntegrationShape = {
  id: z.string().describe("Kebab-case id, e.g. 'acme-analytics' (a-z, 0-9, -)"),
  name: z.string().describe("Display name, e.g. 'Acme Analytics'"),
  description: z.string().describe("Short description (max 120 chars)"),
  category: z
    .enum(["revenue", "deployment", "analytics", "monitoring", "communication"])
    .describe("Integration category"),
  baseUrl: z.string().describe("API base URL, e.g. 'https://api.acme.com' (https only)"),
  icon: z
    .enum([
      "globe",
      "activity",
      "chart",
      "bell",
      "cloud",
      "code",
      "database",
      "dollar",
      "git",
      "package",
      "rocket",
      "users",
      "zap",
    ])
    .optional()
    .describe("Icon key (defaults to 'globe')"),
  provider: z
    .string()
    .optional()
    .describe("Credential grouping key; defaults to id. Share to reuse one credential."),
  apiDocsUrl: z.string().optional().describe("Link to the API's docs"),
  auth: z
    .object({
      scheme: z
        .enum(["bearer", "token", "basic", "none"])
        .optional()
        .describe("Authorization header scheme (defaults to 'bearer'); use 'none' for public APIs"),
      tokenField: z
        .string()
        .optional()
        .describe("Credential field holding the secret; defaults to the first field's key"),
      fields: z
        .array(
          z.object({
            key: z.string(),
            label: z.string(),
            type: z.enum(["text", "password"]).default("password"),
            optional: z.boolean().optional(),
          })
        )
        .optional()
        .describe("Credential fields the user must supply, e.g. [{key:'apiKey',...}]"),
      testPath: z.string().optional().describe("Path hit to validate credentials, e.g. '/me'"),
      docsUrl: z.string().optional(),
    })
    .optional(),
  dataSources: z
    .array(
      z.object({
        action: z.string().describe("Action slug, e.g. 'summary'"),
        description: z.string(),
        cacheTtlSeconds: z.number().describe("Cache freshness window in seconds"),
        path: z
          .string()
          .describe("Path relative to baseUrl, e.g. '/v1/projects/{projectSlug}/summary'"),
        method: z.enum(["GET", "POST"]).optional(),
        query: z
          .record(z.string(), z.string())
          .optional()
          .describe("Query params; values support placeholders"),
      })
    )
    .min(1)
    .describe("At least one data source"),
} as const;

export const connectMcpServerShape = {
  name: z.string().describe("Server slug: lowercase letters, numbers, - and _, e.g. 'sentry'"),
  url: z.string().describe("streamable-http endpoint URL (https, or http on localhost)"),
  authHeader: z
    .string()
    .optional()
    .describe("Authorization header value if required, e.g. 'Bearer sk_live_...'"),
  docsUrl: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  confirmedByUser: z
    .boolean()
    .optional()
    .default(false)
    .describe("Set true ONLY after the user has approved connecting this server"),
} as const;

export const showRestDataShape = {
  integrationId: z.string().describe("Integration id to display, e.g. 'acme-analytics'"),
  action: z.string().default("data").describe("Data-source action on that integration"),
  metrics: z
    .array(
      z.object({
        label: z.string(),
        field: z.string().describe("Dot-path to a value, e.g. 'stats.activeUsers'"),
        format: z
          .enum(["currency", "number", "percent", "date", "relative-time", "duration-seconds"])
          .optional(),
      })
    )
    .optional()
    .describe("KPI metrics to show"),
  list: z
    .object({
      field: z.string().describe("Dot-path to an array, e.g. 'items'"),
      title: z.string().describe("Item field for the title"),
      subtitle: z.string().optional(),
      emptyMessage: z.string().optional(),
    })
    .optional()
    .describe("Optional list of items"),
  projectSlug: z.string().nullable().default(null),
  pageSlug: z.string().default("overview"),
  cellId: z.string().optional().describe("Target cell; omit for the first empty cell"),
} as const;
