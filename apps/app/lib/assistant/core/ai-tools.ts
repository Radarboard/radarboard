/* biome-ignore-all lint/style/useNamingConvention: tool IDs intentionally use snake_case to match external tool contracts. */
/**
 * AI Tool Registry — scalable pattern for exposing data sources to the LLM.
 *
 * Adding a new integration = adding one descriptor to TOOL_DESCRIPTORS.
 * No other files need to change.
 */

import { type DataPoint, detectAnomalies } from "@radarboard/assistant-core/anomaly-detector";
import {
  type MetricSeries,
  scanCorrelations,
} from "@radarboard/assistant-core/correlation-scanner";
import { analyzeTrend } from "@radarboard/assistant-core/trend-analyzer";
import { findDataSource } from "@radarboard/integration-sdk/registry";
import type { LlmRepository } from "@radarboard/types/database";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import { analyzePagePerformance } from "@/lib/ai-actions/analysis/analyze-pages";
import { compareMetrics } from "@/lib/ai-actions/analysis/compare-metrics";
import {
  type SuggestionContext,
  suggestNextActions,
} from "@/lib/ai-actions/analysis/suggest-actions";
import {
  getToolEffectiveness,
  recordToolOutcome,
} from "@/lib/ai-actions/analysis/tool-effectiveness";
import { fetchSkillFromUrl } from "@/lib/ai-actions/extensions/install-skill";
import { executeCreateGithubIssue } from "@/lib/ai-actions/issues/create-github-issue";
import {
  executeCreateLinearIssue,
  executeListLinearLabels,
  executeListLinearTeams,
} from "@/lib/ai-actions/issues/create-linear-issue";
import { executeSendSlackMessage } from "@/lib/ai-actions/issues/send-slack-message";
import {
  deleteInsight,
  recallInsights,
  saveInsight,
} from "@/lib/ai-actions/memory/conversation-memory";
import { thinkStep } from "@/lib/ai-actions/memory/think-step";
import { generateReport } from "@/lib/ai-actions/reports/export-report";
import { buildDataSourceContext } from "@/lib/data-source-context";
import { getFeatureAssistantToolExecutors } from "@/lib/extensions/runtime/server/feature-server";
import type { MemoryService } from "@/lib/memory-service";

/** Call a registered data-source's fetch function with default common params. */
async function callDataSource(
  integration: string,
  action: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const ds = findDataSource(integration, action);
  if (!ds) throw new Error(`Data source ${integration}/${action} not found in registry`);
  const ctx = buildDataSourceContext();
  return ds.fetch(
    { projectSlug: null, range: "30d", timeZone: "UTC", forceRefresh: false, ...params },
    ctx
  );
}

/**
 * Resolve the connected analytics provider (OpenPanel or Umami).
 * Both now return the same normalized AnalyticsOverview shape.
 */
async function resolveAnalyticsProvider(): Promise<"openpanel" | "umami" | null> {
  for (const provider of ["openpanel", "umami"] as const) {
    const ds = findDataSource(provider, "data");
    if (!ds) continue;
    try {
      const ctx = buildDataSourceContext();
      const result = (await ds.fetch(
        { projectSlug: null, range: "7d", timeZone: "UTC", forceRefresh: false },
        ctx
      )) as Record<string, unknown>;
      if (result.configured !== false) return provider;
    } catch {
      // provider not configured, try next
    }
  }
  return null;
}

/**
 * Call the connected analytics provider's data source.
 * Falls back from OpenPanel → Umami automatically.
 */
async function callAnalyticsDataSource(
  action: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const provider = await resolveAnalyticsProvider();
  if (!provider) throw new Error("No analytics provider configured (OpenPanel or Umami)");
  return callDataSource(provider, action, params);
}

// ---------------------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------------------

const projectSlugParam = z.object({
  projectSlug: z.string().nullable().describe("Project slug, or null for all projects"),
});

const rangedProjectParam = projectSlugParam.extend({
  range: z.enum(["today", "7d", "15d", "30d", "3m", "1y"]).default("30d").describe("Time range"),
});

const listProjectParam = projectSlugParam.extend({
  limit: z.number().default(20).describe("Max items to return"),
});

const emptyParam = z.object({});
const featureToolExecutors = getFeatureAssistantToolExecutors();

async function unavailableFeatureTool() {
  return { error: "Feature tool is not registered" };
}

// ---------------------------------------------------------------------------
// Tool Descriptor
// ---------------------------------------------------------------------------

export interface AiToolDescriptor {
  id: string;
  description: string;
  /** Credential key required, or null for always-on tools. */
  credentialKey: string | null;
  parameters: z.ZodTypeAny;
  /** Optional Zod schema to validate the tool's output. On failure, returns a structured error to the LLM. */
  outputSchema?: z.ZodTypeAny;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Descriptors — add new integrations here, one entry per tool
// ---------------------------------------------------------------------------

const TOOL_DESCRIPTORS: AiToolDescriptor[] = [
  {
    id: "get_revenue",
    description: "Get revenue metrics (MRR, trials, churn, subscribers) from RevenueCat.",
    credentialKey: "revenuecat",
    parameters: rangedProjectParam.extend({
      currency: z.enum(["USD", "EUR", "GBP", "CAD", "JPY"]).default("USD"),
    }),
    execute: async (params) => callDataSource("revenuecat", "data", params),
  },
  {
    id: "get_analytics",
    description: "Get web analytics (visitors, page views, sessions, top pages) from OpenPanel.",
    credentialKey: "openpanel",
    parameters: rangedProjectParam,
    execute: async (params) => callDataSource("openpanel", "data", params),
  },
  {
    id: "get_page_analytics",
    description:
      "Get detailed page analytics with bounce rate and avg session duration for up to 50 pages from OpenPanel.",
    credentialKey: "openpanel",
    parameters: rangedProjectParam,
    execute: async (params) => callDataSource("openpanel", "pages", params),
  },
  {
    id: "get_campaign_data",
    description: "Get UTM campaign performance (sources, campaigns, search terms) from OpenPanel.",
    credentialKey: "openpanel",
    parameters: rangedProjectParam,
    execute: async (params) => callDataSource("openpanel", "campaigns", params),
  },
  {
    id: "get_audience_breakdown",
    description: "Get audience breakdown by country, device type, and browser from OpenPanel.",
    credentialKey: "openpanel",
    parameters: rangedProjectParam,
    execute: async (params) => callDataSource("openpanel", "breakdown", params),
  },
  {
    id: "get_health",
    description: "Get uptime monitors and incidents from BetterStack.",
    credentialKey: "betterstack",
    parameters: emptyParam,
    execute: async () => callDataSource("betterstack", "data", {}),
  },
  {
    id: "get_sentry_issues",
    description: "Get unresolved error tracking issues from Sentry.",
    credentialKey: "sentry",
    parameters: projectSlugParam,
    execute: async (params) => callDataSource("sentry", "data", params),
  },
  {
    id: "get_seo",
    description: "Get SEO data (clicks, impressions, CTR, top queries) from Google Search Console.",
    credentialKey: "google-search-console",
    parameters: projectSlugParam.extend({
      siteUrl: z.string().nullable().default(null),
    }),
    execute: async (params) => callDataSource("google-search-console", "data", params),
  },
  {
    id: "get_roadmap",
    description: "Get active releases, project progress, and in-progress work from Linear.",
    credentialKey: "linear",
    parameters: listProjectParam,
    execute: async (params) => callDataSource("linear", "roadmap", params),
  },
  {
    id: "get_shipping",
    description: "Get recent shipping: merged PRs, completed issues, deployments.",
    credentialKey: null,
    parameters: listProjectParam,
    execute: async (params) => callDataSource("shipping", "data", params),
  },
  {
    id: "get_app_store",
    description: "Get App Store data: app info, reviews, versions from App Store Connect.",
    credentialKey: "app-store-connect",
    parameters: projectSlugParam,
    execute: async (params) => callDataSource("app-store-connect", "data", params),
  },
  {
    id: "list_projects",
    description: "List all projects with their slugs, goals, priorities, and stage.",
    credentialKey: null,
    parameters: emptyParam,
    execute: async () => {
      const { getSettingsRepo } = await import("@/data/core/repository");
      const repo = getSettingsRepo();
      const [projectOrder, projectContextMap] = await Promise.all([
        repo.getProjectOrder(),
        repo.getProjectContextMap().catch(() => ({})),
      ]);
      return { projectSlugs: projectOrder, contexts: projectContextMap };
    },
  },
  {
    id: "get_debug_events",
    description:
      "Query durable internal debug events across chat, plugins, notifications, and MCP tools.",
    credentialKey: null,
    parameters: z.object({
      level: z.enum(["debug", "info", "warn", "error"]).optional(),
      source: z.string().optional(),
      eventType: z.string().optional(),
      projectSlug: z.string().nullable().optional(),
      traceId: z.string().optional(),
      conversationId: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().default(50).describe("Max events to return"),
    }),
    execute: async (params) => {
      const { queryDebugEvents } = await import("@/lib/debug-events");
      return {
        events: await queryDebugEvents({
          level: params.level as "debug" | "info" | "warn" | "error" | undefined,
          source: params.source as string | undefined,
          eventType: params.eventType as string | undefined,
          projectSlug: (params.projectSlug as string | null | undefined) ?? undefined,
          traceId: params.traceId as string | undefined,
          conversationId: params.conversationId as string | undefined,
          search: params.search as string | undefined,
          limit: params.limit as number | undefined,
        }),
      };
    },
  },
  {
    id: "get_stripe",
    description: "Get revenue metrics (MRR, subscriptions, charges, churn) from Stripe.",
    credentialKey: "stripe",
    parameters: rangedProjectParam,
    execute: async (params) => callDataSource("stripe", "data", params),
  },
  {
    id: "get_incidents",
    description: "Get active and recent incidents, on-call schedule from PagerDuty.",
    credentialKey: "pagerduty",
    parameters: emptyParam,
    execute: async () => callDataSource("pagerduty", "data", {}),
  },
  {
    id: "get_stripe_daily_revenue",
    description: "Get daily revenue aggregation from Stripe for trend analysis.",
    credentialKey: "stripe",
    parameters: rangedProjectParam,
    execute: async (params) => callDataSource("stripe", "daily-revenue", params),
  },
  {
    id: "get_discord",
    description:
      "Get Discord server overview: member count, online count, channel count, boost level.",
    credentialKey: "discord",
    parameters: emptyParam,
    execute: async () => callDataSource("discord", "data", {}),
  },
  {
    id: "get_discord_messages",
    description: "Get recent messages from a Discord channel.",
    credentialKey: "discord",
    parameters: emptyParam.extend({
      channelId: z.string().describe("Discord channel ID to fetch messages from"),
    }),
    execute: async (params) => callDataSource("discord", "messages", params),
  },
  {
    id: "get_umami",
    description:
      "Get web analytics (pageviews, visitors, active visitors, top pages, audience breakdown) from Umami.",
    credentialKey: "umami",
    parameters: rangedProjectParam,
    execute: async (params) => callDataSource("umami", "data", params),
  },
  {
    id: "get_umami_pages",
    description: "Get top pages with view counts from Umami.",
    credentialKey: "umami",
    parameters: rangedProjectParam,
    execute: async (params) => callDataSource("umami", "pages", params),
  },
  {
    id: "get_umami_breakdown",
    description: "Get audience breakdown by country, device, and browser from Umami.",
    credentialKey: "umami",
    parameters: rangedProjectParam,
    execute: async (params) => callDataSource("umami", "breakdown", params),
  },
  // --- Provider-agnostic analytics tools ---
  {
    id: "get_site_analytics",
    description:
      "Get web analytics (visitors, sessions, page views, top pages, referrers) from whichever analytics provider is connected (OpenPanel or Umami). Returns the normalized AnalyticsOverview shape.",
    credentialKey: null,
    parameters: rangedProjectParam,
    execute: async (params) => callAnalyticsDataSource("data", params),
  },
  {
    id: "get_site_pages",
    description:
      "Get detailed page analytics from whichever analytics provider is connected (OpenPanel or Umami). Returns pages with sessions, bounce rate, and avg duration.",
    credentialKey: null,
    parameters: rangedProjectParam,
    execute: async (params) => callAnalyticsDataSource("pages", params),
  },
  // Add new integrations here — one entry per tool. Nothing else to change.
];

// ---------------------------------------------------------------------------
// Registry (immutable Map for O(1) lookup)
// ---------------------------------------------------------------------------

export const AI_TOOL_REGISTRY = new Map<string, AiToolDescriptor>(
  TOOL_DESCRIPTORS.map((d) => [d.id, d])
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All tool names (for system prompt injection). */
export function getAvailableToolNames(): string[] {
  return TOOL_DESCRIPTORS.map((d) => d.id);
}

/**
 * Build the AI SDK tool set for streamText().
 *
 * @param connectedKeys - If provided, only tools whose credentialKey is in
 *   this set (or null = always-on) are included. Omit to include all.
 */
export function buildAiTools(connectedKeys?: string[]) {
  const keySet = connectedKeys ? new Set(connectedKeys) : null;

  // biome-ignore lint/suspicious/noExplicitAny: tools have varying schema types
  const tools: Record<string, any> = {};

  for (const desc of TOOL_DESCRIPTORS) {
    if (keySet && desc.credentialKey !== null && !keySet.has(desc.credentialKey)) {
      continue;
    }
    const outputSchema = desc.outputSchema;
    const wrappedExecute = outputSchema
      ? async (params: Record<string, unknown>) => {
          const result = await desc.execute(params);
          const parsed = outputSchema.safeParse(result);
          if (!parsed.success) {
            return {
              _validationError: true,
              message: "Tool output did not match expected schema",
              issues: parsed.error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              })),
            };
          }
          return parsed.data;
        }
      : desc.execute;

    // biome-ignore lint/suspicious/noExplicitAny: tool() overloads are strict about generic params
    tools[desc.id] = (tool as any)({
      description: desc.description,
      inputSchema: zodSchema(desc.parameters),
      execute: wrappedExecute,
    });
  }

  return tools;
}

/**
 * Build self-modification tools — let the AI update its own skills, project
 * context, and LLM config mid-conversation.
 */
export function buildSelfTools() {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    update_skill: (tool as any)({
      description:
        "Update a skill's instructions. Use this when the user asks to change how you approach a topic, make a skill more concise, add domain knowledge, or fix a pattern that isn't working. Built-in skill IDs: project-advisor, revenue-analyst, growth-advisor, engineering-health, prioritization.",
      inputSchema: zodSchema(
        z.object({
          skillId: z.string().describe("The skill ID to update"),
          instructions: z.string().describe("The new instructions for this skill"),
        })
      ),
      execute: async (params: { skillId: string; instructions: string }) => {
        const { getSettingsRepo } = await import("@/data/core/repository");
        const repo = getSettingsRepo();
        const current = await repo.getLlmConfig();
        const skillOverrides = {
          ...(current.skillOverrides ?? {}),
          [params.skillId]: params.instructions,
        };
        await repo.setLlmConfig({ ...current, skillOverrides });
        return { updated: true, skillId: params.skillId };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    update_project_context: (tool as any)({
      description:
        "Update a project's goals, priorities, notes, or stage. Use this when the user declares a decision, changes focus, updates a goal status, or shares strategic context about a specific project.",
      inputSchema: zodSchema(
        z.object({
          projectSlug: z.string().describe("The project slug to update"),
          notes: z.string().optional().describe("Replace the project notes with this text"),
          stage: z
            .enum(["idea", "mvp", "growth", "mature", "sunset"])
            .optional()
            .describe("Update the project stage"),
          addGoal: z
            .object({
              title: z.string(),
              status: z.enum(["active", "achieved", "dropped"]).default("active"),
              targetDate: z.string().optional(),
            })
            .optional()
            .describe("Add a new goal to the project"),
          updateGoalStatus: z
            .object({ title: z.string(), status: z.enum(["active", "achieved", "dropped"]) })
            .optional()
            .describe("Change an existing goal's status by matching its title"),
          addPriority: z
            .object({
              title: z.string(),
              impact: z.enum(["low", "medium", "high"]).default("medium"),
              effort: z.enum(["small", "medium", "large"]).default("medium"),
              status: z.enum(["active", "done", "dropped"]).default("active"),
            })
            .optional()
            .describe("Add a new priority to the project"),
          updatePriority: z
            .object({
              title: z.string().describe("Match an existing priority by title"),
              nextTitle: z.string().optional().describe("Rename the priority"),
              impact: z.enum(["low", "medium", "high"]).optional(),
              effort: z.enum(["small", "medium", "large"]).optional(),
              status: z.enum(["active", "done", "dropped"]).optional(),
            })
            .optional()
            .describe("Update an existing priority's title, impact, effort, or status"),
        })
      ),
      execute: async (params: {
        projectSlug: string;
        notes?: string;
        stage?: "idea" | "mvp" | "growth" | "mature" | "sunset";
        addGoal?: { title: string; status: "active" | "achieved" | "dropped"; targetDate?: string };
        updateGoalStatus?: { title: string; status: "active" | "achieved" | "dropped" };
        addPriority?: {
          title: string;
          impact: "low" | "medium" | "high";
          effort: "small" | "medium" | "large";
          status: "active" | "done" | "dropped";
        };
        updatePriority?: {
          title: string;
          nextTitle?: string;
          impact?: "low" | "medium" | "high";
          effort?: "small" | "medium" | "large";
          status?: "active" | "done" | "dropped";
        };
      }) => {
        const { getSettingsRepo } = await import("@/data/core/repository");
        const { emptyProjectContext } = await import("@radarboard/types/project-context");
        const repo = getSettingsRepo();
        const map = await repo.getProjectContextMap();
        const existing = map[params.projectSlug] ?? emptyProjectContext();

        const updated = { ...existing };
        if (params.notes !== undefined) updated.notes = params.notes;
        if (params.stage !== undefined) updated.stage = params.stage;
        if (params.addGoal) {
          updated.goals = [...existing.goals, { id: crypto.randomUUID(), ...params.addGoal }];
        }
        if (params.updateGoalStatus) {
          const target = params.updateGoalStatus;
          updated.goals = existing.goals.map((g) =>
            g.title === target.title ? { ...g, status: target.status } : g
          );
        }
        if (params.addPriority) {
          updated.priorities = [
            ...existing.priorities,
            { id: crypto.randomUUID(), ...params.addPriority },
          ];
        }
        if (params.updatePriority) {
          const target = params.updatePriority;
          updated.priorities = existing.priorities.map((priority) =>
            priority.title === target.title
              ? {
                  ...priority,
                  title: target.nextTitle ?? priority.title,
                  impact: target.impact ?? priority.impact,
                  effort: target.effort ?? priority.effort,
                  status: target.status ?? priority.status,
                }
              : priority
          );
        }

        await repo.setProjectContextMap({ ...map, [params.projectSlug]: updated });
        return { updated: true, projectSlug: params.projectSlug };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    update_llm_config: (tool as any)({
      description:
        "Update the AI system identity prompt or extraction prompt. Use only when the user explicitly asks to change how you introduce yourself, your persona, or how conversation memories are extracted.",
      inputSchema: zodSchema(
        z.object({
          identityPrompt: z
            .string()
            .optional()
            .describe("New identity/persona paragraph for the system prompt"),
          extractionPrompt: z
            .string()
            .optional()
            .describe("New system prompt for post-conversation memory extraction"),
        })
      ),
      execute: async (params: { identityPrompt?: string; extractionPrompt?: string }) => {
        const { getSettingsRepo } = await import("@/data/core/repository");
        const repo = getSettingsRepo();
        const current = await repo.getLlmConfig();
        const next = { ...current };
        if (params.identityPrompt !== undefined) next.identityPrompt = params.identityPrompt;
        if (params.extractionPrompt !== undefined) next.extractionPrompt = params.extractionPrompt;
        await repo.setLlmConfig(next);
        return { updated: true };
      },
    }),
  };
}

/**
 * Build memory tools (remember/recall) that require a runtime MemoryService.
 * These are merged into the tool set alongside data tools.
 */
export function buildMemoryTools(memoryService: MemoryService) {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    remember: (tool as any)({
      description:
        "Save a named fact to persistent memory. Use this when the user tells you something important to remember (priorities, decisions, context). The fact persists across conversations.",
      inputSchema: zodSchema(
        z.object({
          key: z
            .string()
            .describe("Short identifier for the fact (e.g. 'current_focus', 'q4_goals')"),
          value: z.string().describe("The fact to remember"),
          projectSlug: z
            .string()
            .nullable()
            .default(null)
            .describe("Project this fact relates to, or null for global"),
        })
      ),
      execute: async (params: { key: string; value: string; projectSlug: string | null }) => {
        await memoryService.remember(params.key, params.value, params.projectSlug);
        return { saved: true, key: params.key };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    recall: (tool as any)({
      description:
        "Search persistent memory for facts relevant to a query. Returns the most semantically similar memories. Use this to retrieve previously saved context, priorities, or decisions.",
      inputSchema: zodSchema(
        z.object({
          query: z.string().describe("What to search for in memory"),
          limit: z.number().default(5).describe("Max memories to return"),
          projectSlug: z
            .string()
            .nullable()
            .default(null)
            .describe("Filter to a specific project, or null for all"),
        })
      ),
      execute: async (params: { query: string; limit: number; projectSlug: string | null }) => {
        const results = await memoryService.recall(
          params.query,
          params.limit,
          params.projectSlug ?? undefined
        );
        return { memories: results };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    forget: (tool as any)({
      description:
        "Delete a specific memory by its id. Use when the user asks to remove a saved fact.",
      inputSchema: zodSchema(
        z.object({
          memoryId: z.string().describe("The id of the memory to delete"),
        })
      ),
      execute: async (params: { memoryId: string }) => {
        await memoryService.forget(params.memoryId);
        return { deleted: true };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    list_memories: (tool as any)({
      description: "List all saved memories, optionally filtered by project.",
      inputSchema: zodSchema(
        z.object({
          projectSlug: z
            .string()
            .nullable()
            .default(null)
            .describe("Filter to a project, or null for all"),
        })
      ),
      execute: async (params: { projectSlug: string | null }) => {
        const results = await memoryService.listAll(params.projectSlug ?? undefined);
        return { memories: results };
      },
    }),
  };
}

/**
 * Build assistant workflow artifact tools.
 * These give the model explicit read/write access to saved workflow outputs.
 */
export function buildArtifactTools(llmRepo: LlmRepository) {
  const artifactSchema = z.object({
    id: z.string().optional().describe("Existing artifact id to update. Omit to create a new one."),
    projectSlug: z
      .string()
      .nullable()
      .default(null)
      .describe("Project this artifact belongs to, or null for cross-project"),
    mode: z
      .enum(["explore", "plan", "review", "qa"])
      .describe("Workflow mode that produced the artifact"),
    title: z.string().describe("Short artifact title"),
    summary: z.string().describe("One-paragraph summary"),
    body: z.string().describe("Full artifact body in markdown"),
    contentType: z
      .enum(["markdown", "html", "mermaid"])
      .default("markdown")
      .describe("How to render the artifact body"),
    status: z
      .enum(["draft", "completed", "blocked", "needs_input", "failed"])
      .default("completed")
      .describe("Current artifact status"),
    sourceConversationId: z
      .string()
      .nullable()
      .default(null)
      .describe("Conversation this artifact came from, or null"),
    nextMode: z
      .enum(["default", "explore", "plan", "review", "qa"])
      .nullable()
      .default(null)
      .describe("Recommended next assistant mode"),
    nextReason: z.string().nullable().default(null).describe("Why that next mode is recommended"),
  });

  return {
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    save_artifact: (tool as any)({
      description:
        "Create or update a durable assistant workflow artifact. Use this when you finish an explore, plan, review, or QA workflow and want the output to be reusable later.",
      inputSchema: zodSchema(artifactSchema),
      execute: async (
        params: z.infer<typeof artifactSchema>
      ): Promise<{ saved: true; artifactId: string }> => {
        const artifactId = params.id ?? crypto.randomUUID();
        const createdAt = new Date().toISOString();
        await llmRepo.upsertArtifact({
          id: artifactId,
          projectSlug: params.projectSlug,
          mode: params.mode,
          title: params.title,
          summary: params.summary,
          body: params.body,
          contentType: params.contentType,
          status: params.status,
          sourceConversationId: params.sourceConversationId,
          createdAt,
          nextMode: params.nextMode,
          nextReason: params.nextReason,
          evidenceRefs: [],
        });
        return { saved: true, artifactId };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    list_artifacts: (tool as any)({
      description:
        "List saved assistant artifacts, optionally filtered by project, mode, or source conversation.",
      inputSchema: zodSchema(
        z.object({
          projectSlug: z.string().optional().describe("Only artifacts for this project"),
          mode: z
            .enum(["explore", "plan", "review", "qa"])
            .optional()
            .describe("Only artifacts from this workflow mode"),
          sourceConversationId: z
            .string()
            .optional()
            .describe("Only artifacts from this conversation"),
          limit: z.number().default(10).describe("Maximum number of artifacts to return"),
        })
      ),
      execute: async (params: {
        projectSlug?: string;
        mode?: "explore" | "plan" | "review" | "qa";
        sourceConversationId?: string;
        limit: number;
      }) => ({
        artifacts: await llmRepo.listArtifacts({
          projectSlug: params.projectSlug,
          mode: params.mode,
          sourceConversationId: params.sourceConversationId,
          limit: params.limit,
        }),
      }),
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    get_artifact: (tool as any)({
      description: "Get one saved assistant artifact by id.",
      inputSchema: zodSchema(
        z.object({
          artifactId: z.string().describe("Artifact id"),
        })
      ),
      execute: async (params: { artifactId: string }) => ({
        artifact: await llmRepo.getArtifact(params.artifactId),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Action tools — write-back capabilities (T1-T3, T8, T10-T11, T13)
// ---------------------------------------------------------------------------

async function resolveCredential(key: string): Promise<Record<string, string> | null> {
  const ctx = buildDataSourceContext();
  return ctx.resolveCredential(key);
}

/**
 * Build action tools — tools that write to external services, analyze data,
 * and provide proactive suggestions. All external calls go through integrations.
 */
export function buildActionTools() {
  return {
    // --- T1: Create Linear Issue ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    create_linear_issue: (tool as any)({
      description:
        "Create a new issue in Linear. Use when the user wants to file a bug, track an anomaly, or create a task from a conversation insight.",
      inputSchema: zodSchema(
        z.object({
          title: z.string().describe("Issue title"),
          description: z.string().optional().describe("Issue description (markdown)"),
          teamId: z.string().optional().describe("Team ID. Omit to use the first team."),
          priority: z
            .number()
            .min(0)
            .max(4)
            .optional()
            .describe("Priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low"),
          labelIds: z.array(z.string()).optional().describe("Label IDs to apply"),
        })
      ),
      execute: async (params: {
        title: string;
        description?: string;
        teamId?: string;
        priority?: number;
        labelIds?: string[];
      }) => {
        const creds = await resolveCredential("linear");
        if (!creds?.apiKey) return { error: "Linear credentials not configured" };
        return executeCreateLinearIssue({ apiKey: creds.apiKey }, params);
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    list_linear_teams: (tool as any)({
      description:
        "List all teams in the Linear workspace. Use to help pick a team for issue creation.",
      inputSchema: zodSchema(emptyParam),
      execute: async () => {
        const creds = await resolveCredential("linear");
        if (!creds?.apiKey) return { error: "Linear credentials not configured" };
        return { teams: await executeListLinearTeams({ apiKey: creds.apiKey }) };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    list_linear_labels: (tool as any)({
      description: "List all issue labels in Linear. Use to help pick labels for issue creation.",
      inputSchema: zodSchema(emptyParam),
      execute: async () => {
        const creds = await resolveCredential("linear");
        if (!creds?.apiKey) return { error: "Linear credentials not configured" };
        return { labels: await executeListLinearLabels({ apiKey: creds.apiKey }) };
      },
    }),

    // --- T2: Create GitHub Issue ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    create_github_issue: (tool as any)({
      description:
        "Create a new issue in a GitHub repository. Use when the user wants to report a bug or track a task on GitHub.",
      inputSchema: zodSchema(
        z.object({
          repo: z.string().describe("Repository in 'owner/name' format"),
          title: z.string().describe("Issue title"),
          body: z.string().optional().describe("Issue body (markdown)"),
          labels: z.array(z.string()).optional().describe("Label names to apply"),
        })
      ),
      execute: async (params: {
        repo: string;
        title: string;
        body?: string;
        labels?: string[];
      }) => {
        const creds = await resolveCredential("github");
        if (!creds?.token) return { error: "GitHub credentials not configured" };
        const [owner, name] = params.repo.split("/");
        if (!owner || !name)
          return { error: `Invalid repo format "${params.repo}". Expected "owner/name".` };
        return executeCreateGithubIssue(
          { token: creds.token },
          { owner, repo: name, title: params.title, body: params.body, labels: params.labels }
        );
      },
    }),

    // --- T3: Send Slack Message ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    send_slack_message: (tool as any)({
      description:
        "Send a message to Slack via incoming webhook. Use when the user wants to notify the team about an anomaly, outage, or important finding. Rate limited to 5/min.",
      inputSchema: zodSchema(
        z.object({
          message: z.string().describe("Message text"),
          channel: z.string().optional().describe("Channel override (if webhook supports it)"),
        })
      ),
      execute: async (params: { message: string; channel?: string }) => {
        const creds = await resolveCredential("slack");
        if (!creds?.webhookUrl) return { error: "Slack credentials not configured" };
        return executeSendSlackMessage(
          { webhookUrl: creds.webhookUrl },
          { text: params.message, channel: params.channel }
        );
      },
    }),

    // --- T8: Detect Anomalies ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    detect_anomalies: (tool as any)({
      description:
        "Run anomaly detection on a metric from any connected integration. Returns data points that deviate significantly from the mean (z-score analysis).",
      inputSchema: zodSchema(
        z.object({
          integration: z.string().describe("Integration ID (e.g. 'openpanel', 'revenuecat')"),
          action: z.string().default("data").describe("Data source action"),
          sensitivity: z.number().default(2).describe("Z-score threshold (lower = more sensitive)"),
          range: z.enum(["7d", "15d", "30d", "3m"]).default("30d").describe("Time range"),
        })
      ),
      execute: async (params: {
        integration: string;
        action: string;
        sensitivity: number;
        range: string;
      }) => {
        const data = await callDataSource(params.integration, params.action, {
          range: params.range,
        });
        const values = extractNumericValues(data);
        if (!values.length) return { anomalies: [], message: "No numeric data found in response" };

        const dataPoints: DataPoint[] = values.map((value, i) => ({
          timestamp: Date.now() - (values.length - i) * 3600000,
          value,
        }));

        const anomalies = detectAnomalies(dataPoints, { sensitivity: params.sensitivity });
        return { anomalies, totalPoints: values.length };
      },
    }),

    // --- T8: Analyze Trend ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    analyze_trend: (tool as any)({
      description:
        "Analyze the trend direction and change percentage for a metric. Compares current period to previous period and returns direction, velocity, and forecast.",
      inputSchema: zodSchema(
        z.object({
          integration: z.string().describe("Integration ID"),
          action: z.string().default("data").describe("Data source action"),
          range: z.enum(["7d", "15d", "30d", "3m"]).default("30d").describe("Time range"),
        })
      ),
      execute: async (params: { integration: string; action: string; range: string }) => {
        const data = await callDataSource(params.integration, params.action, {
          range: params.range,
        });
        const values = extractNumericValues(data);
        if (values.length < 4) return { error: "Not enough data points for trend analysis" };

        const mid = Math.floor(values.length / 2);
        const previous = values.slice(0, mid);
        const current = values.slice(mid);
        return analyzeTrend(current, previous);
      },
    }),

    // --- T10: Think Step ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    think_step: (tool as any)({
      description:
        "Record a reasoning step before taking action. Use this to show your thought process when analyzing data, diagnosing issues, or planning multi-step actions. The reasoning is displayed to the user.",
      inputSchema: zodSchema(
        z.object({
          thought: z.string().describe("Your current reasoning or observation"),
          plan: z.array(z.string()).optional().describe("Planned next steps"),
        })
      ),
      execute: async (params: { thought: string; plan?: string[] }) => {
        return thinkStep(params);
      },
    }),

    // --- T11: Daily Briefing ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    generate_daily_briefing: (tool as any)({
      description:
        "Generate a comprehensive daily briefing across all connected integrations. Runs anomaly detection and trend analysis on each, returns a formatted markdown summary.",
      inputSchema: zodSchema(emptyParam),
      execute: featureToolExecutors.generate_daily_briefing ?? unavailableFeatureTool,
    }),

    // --- T13: Suggest Next Actions ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    suggest_next_actions: (tool as any)({
      description:
        "Suggest 3-5 actionable next steps based on the current conversation context. Call this after presenting analysis results to help the user decide what to do next.",
      inputSchema: zodSchema(
        z.object({
          hasAnomalies: z.boolean().default(false).describe("Whether anomalies were detected"),
          hasTrends: z.boolean().default(false).describe("Whether trends were analyzed"),
          hasComparisons: z.boolean().default(false).describe("Whether metrics were compared"),
          integrations: z.array(z.string()).default([]).describe("Connected integration IDs"),
          recentToolCalls: z
            .array(z.string())
            .default([])
            .describe("Tool IDs already called in this conversation"),
        })
      ),
      execute: async (params: SuggestionContext) => {
        return { suggestions: suggestNextActions(params) };
      },
    }),

    // --- T4: Workflow CRUD ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    create_workflow: (tool as any)({
      description:
        "Create an automation workflow. Define a trigger (schedule, event, or threshold) and steps (fetch data, analyze with LLM, notify, or branch conditionally).",
      inputSchema: zodSchema(
        z.object({
          name: z.string().describe("Workflow name"),
          description: z.string().describe("What this workflow does"),
          triggerType: z.enum(["schedule", "event", "threshold"]).describe("Trigger type"),
          triggerConfig: z
            .record(z.string(), z.unknown())
            .describe("Trigger configuration (cron, channel, dataSource, etc.)"),
          steps: z.array(z.record(z.string(), z.unknown())).describe("Workflow steps"),
        })
      ),
      execute: featureToolExecutors.create_workflow ?? unavailableFeatureTool,
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    list_workflows: (tool as any)({
      description: "List all saved automation workflows.",
      inputSchema: zodSchema(emptyParam),
      execute: featureToolExecutors.list_workflows ?? unavailableFeatureTool,
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    delete_workflow: (tool as any)({
      description: "Delete an automation workflow by ID.",
      inputSchema: zodSchema(
        z.object({ workflowId: z.string().describe("Workflow ID to delete") })
      ),
      execute: featureToolExecutors.delete_workflow ?? unavailableFeatureTool,
    }),

    // --- T5: Export Report ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    export_report: (tool as any)({
      description:
        "Export the current analysis as a shareable markdown report. Generates a report with titled sections and returns a report ID for download.",
      inputSchema: zodSchema(
        z.object({
          title: z.string().describe("Report title"),
          sections: z
            .array(
              z.object({
                title: z.string().describe("Section title"),
                content: z.string().describe("Section content (markdown)"),
              })
            )
            .describe("Report sections"),
        })
      ),
      execute: async (params: {
        title: string;
        sections: { title: string; content: string }[];
      }) => {
        const report = await generateReport(params.title, params.sections);
        return {
          reportId: report.id,
          title: report.title,
          downloadUrl: `/api/reports/${report.id}`,
        };
      },
    }),

    // --- T6: Compare Metrics ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    compare_metrics: (tool as any)({
      description:
        "Compare two metrics across integrations. Computes trend for each and their cross-correlation. Use when the user asks how one metric relates to another.",
      inputSchema: zodSchema(
        z.object({
          integrationA: z.string().describe("First integration ID"),
          actionA: z.string().default("data").describe("First data source action"),
          integrationB: z.string().describe("Second integration ID"),
          actionB: z.string().default("data").describe("Second data source action"),
          range: z.enum(["7d", "15d", "30d", "3m"]).default("30d").describe("Time range"),
        })
      ),
      execute: async (params: {
        integrationA: string;
        actionA: string;
        integrationB: string;
        actionB: string;
        range: string;
      }) => {
        const [dataA, dataB] = await Promise.all([
          callDataSource(params.integrationA, params.actionA, { range: params.range }),
          callDataSource(params.integrationB, params.actionB, { range: params.range }),
        ]);
        const valuesA = extractNumericValues(dataA);
        const valuesB = extractNumericValues(dataB);
        if (valuesA.length < 4 || valuesB.length < 4) {
          return { error: "Not enough data points for comparison" };
        }
        return compareMetrics(
          { integration: params.integrationA, action: params.actionA },
          valuesA,
          { integration: params.integrationB, action: params.actionB },
          valuesB
        );
      },
    }),

    // --- T9: Correlation Scanner ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    scan_correlations: (tool as any)({
      description:
        "Scan all connected integrations for pairwise metric correlations. Discovers which metrics move together (e.g., 'revenue drops when error rate spikes').",
      inputSchema: zodSchema(
        z.object({
          integrations: z
            .array(
              z.object({
                integration: z.string(),
                action: z.string().default("data"),
              })
            )
            .describe("Integrations to scan"),
          topN: z.number().default(10).describe("Number of top correlations to return"),
          range: z.enum(["7d", "15d", "30d", "3m"]).default("30d"),
        })
      ),
      execute: async (params: {
        integrations: { integration: string; action: string }[];
        topN: number;
        range: string;
      }) => {
        const seriesList: MetricSeries[] = [];
        for (const spec of params.integrations) {
          try {
            const data = await callDataSource(spec.integration, spec.action, {
              range: params.range,
            });
            const values = extractNumericValues(data);
            if (values.length >= 3) {
              seriesList.push({ integration: spec.integration, action: spec.action, values });
            }
          } catch {
            // Skip failing integrations
          }
        }
        if (seriesList.length < 2)
          return { error: "Need at least 2 integrations with data to correlate" };
        return { correlations: scanCorrelations(seriesList, params.topN) };
      },
    }),

    // --- T7: Diagnose Metric (root cause) ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    diagnose_metric: (tool as any)({
      description:
        "Diagnose the probable root cause of a metric anomaly. Cross-references the anomaly with other integration metrics, uptime incidents, and recent deployments.",
      inputSchema: zodSchema(
        z.object({
          integration: z.string().describe("Integration where anomaly was detected"),
          action: z.string().default("data"),
          range: z.enum(["7d", "15d", "30d"]).default("7d"),
        })
      ),
      execute: async (params: { integration: string; action: string; range: string }) => {
        const checks: { source: string; status: string; detail: unknown }[] = [];

        // Check BetterStack for incidents
        try {
          const health = await callDataSource("betterstack", "data", {});
          checks.push({ source: "betterstack", status: "checked", detail: health });
        } catch {
          checks.push({ source: "betterstack", status: "unavailable", detail: null });
        }

        // Check Sentry for error spikes
        try {
          const sentry = await callDataSource("sentry", "data", {});
          checks.push({ source: "sentry", status: "checked", detail: sentry });
        } catch {
          checks.push({ source: "sentry", status: "unavailable", detail: null });
        }

        // Check PagerDuty for active incidents
        try {
          const pd = await callDataSource("pagerduty", "data", {});
          checks.push({ source: "pagerduty", status: "checked", detail: pd });
        } catch {
          checks.push({ source: "pagerduty", status: "unavailable", detail: null });
        }

        // Check recent deploys via shipping
        try {
          const shipping = await callDataSource("shipping", "data", { limit: 5 });
          checks.push({ source: "shipping", status: "checked", detail: shipping });
        } catch {
          checks.push({ source: "shipping", status: "unavailable", detail: null });
        }

        // Anomaly detection on the target metric
        try {
          const data = await callDataSource(params.integration, params.action, {
            range: params.range,
          });
          const values = extractNumericValues(data);
          const dataPoints: DataPoint[] = values.map((value, i) => ({
            timestamp: Date.now() - (values.length - i) * 3600000,
            value,
          }));
          const anomalies = detectAnomalies(dataPoints, { sensitivity: 2 });
          checks.push({
            source: `${params.integration}/${params.action}`,
            status: "analyzed",
            detail: { anomalies, totalPoints: values.length },
          });
        } catch {
          checks.push({
            source: `${params.integration}/${params.action}`,
            status: "failed",
            detail: null,
          });
        }

        return {
          diagnosis: checks,
          message:
            "Cross-referenced anomaly with health, errors, and recent deploys. Review each source for probable causes.",
        };
      },
    }),

    // --- T12: Conversation Memory ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    save_conversation_insight: (tool as any)({
      description:
        "Save a key insight from this conversation (anomaly found, action taken, user preference) for recall in future conversations.",
      inputSchema: zodSchema(
        z.object({
          key: z.string().describe("Short identifier (e.g., 'revenue_drop_march')"),
          value: z.string().describe("The insight to save"),
          category: z
            .enum(["anomaly", "action", "preference", "finding"])
            .describe("Insight category"),
        })
      ),
      execute: async (params: {
        key: string;
        value: string;
        category: "anomaly" | "action" | "preference" | "finding";
      }) => {
        const insight = saveInsight(params.key, params.value, params.category);
        return { saved: true, insightId: insight.id };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    recall_conversation_insights: (tool as any)({
      description: "Recall saved conversation insights. Optionally filter by category.",
      inputSchema: zodSchema(
        z.object({
          category: z.enum(["anomaly", "action", "preference", "finding"]).optional(),
          limit: z.number().default(20),
        })
      ),
      execute: async (params: {
        category?: "anomaly" | "action" | "preference" | "finding";
        limit: number;
      }) => {
        return { insights: recallInsights(params.category, params.limit) };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    delete_conversation_insight: (tool as any)({
      description: "Delete a saved conversation insight by ID.",
      inputSchema: zodSchema(z.object({ insightId: z.string() })),
      execute: async (params: { insightId: string }) => {
        return { deleted: deleteInsight(params.insightId) };
      },
    }),

    // --- T14: Tool Effectiveness ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    rate_tool_result: (tool as any)({
      description:
        "Record user feedback on a tool result. Use when the user indicates a tool result was helpful or unhelpful.",
      inputSchema: zodSchema(
        z.object({
          toolId: z.string().describe("The tool that was called"),
          success: z.boolean().describe("Whether the tool call succeeded"),
          rating: z.enum(["positive", "negative"]).optional().describe("User's rating"),
        })
      ),
      execute: async (params: {
        toolId: string;
        success: boolean;
        rating?: "positive" | "negative";
      }) => {
        recordToolOutcome(params.toolId, params.success, params.rating);
        return { recorded: true };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    get_tool_effectiveness: (tool as any)({
      description: "Get effectiveness metrics for AI tools. Shows success rates and user ratings.",
      inputSchema: zodSchema(
        z.object({
          toolId: z.string().optional().describe("Filter to a specific tool"),
        })
      ),
      execute: async (params: { toolId?: string }) => {
        return { effectiveness: getToolEffectiveness(params.toolId) };
      },
    }),

    // --- T6: SEO Insights (Round 7) ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    seo_insights: (tool as any)({
      description:
        "Analyze SEO data and provide actionable recommendations. Identifies low-CTR high-impression queries, queries ranking 4-10 (close to page 1), and top performers.",
      inputSchema: zodSchema(
        z.object({
          range: z.enum(["7d", "15d", "30d", "3m"]).default("30d"),
        })
      ),
      execute: async (params: { range: string }) => {
        const rawData = (await callDataSource("google-search-console", "data", {
          range: params.range,
        })) as Record<string, unknown> | null;
        if (!rawData) return { error: "Google Search Console not configured" };

        // GSC data is nested under .seo.queries
        const seo = (rawData.seo ?? rawData) as Record<string, unknown>;
        const queries = (seo.queries ?? []) as Array<{
          query: string;
          clicks: number;
          impressions: number;
          ctr: number;
          position: number;
        }>;
        if (!queries.length) return { insights: [], message: "No query data available" };

        const lowCtrHighImpressions = queries
          .filter((q) => q.impressions > 100 && q.ctr < 0.03)
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 10)
          .map((q) => ({
            query: q.query,
            impressions: q.impressions,
            ctr: Math.round(q.ctr * 10000) / 100,
            position: Math.round(q.position * 10) / 10,
            recommendation: "Optimize title tag and meta description to improve CTR",
          }));

        const almostPage1 = queries
          .filter((q) => q.position >= 4 && q.position <= 10 && q.impressions > 50)
          .sort((a, b) => a.position - b.position)
          .slice(0, 10)
          .map((q) => ({
            query: q.query,
            position: Math.round(q.position * 10) / 10,
            impressions: q.impressions,
            recommendation: "Strengthen content — close to page 1",
          }));

        const topPerformers = queries
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 5)
          .map((q) => ({
            query: q.query,
            clicks: q.clicks,
            impressions: q.impressions,
            ctr: Math.round(q.ctr * 10000) / 100,
          }));

        return {
          insights: {
            optimizationOpportunities: lowCtrHighImpressions,
            almostPage1,
            topPerformers,
          },
          summary: `Found ${lowCtrHighImpressions.length} CTR optimization opportunities and ${almostPage1.length} queries close to page 1.`,
        };
      },
    }),

    // --- T8: Deploy-Revenue Correlation (Round 7) ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    correlate_with_deploys: (tool as any)({
      description:
        "Check if a recent deployment correlates with a metric anomaly. Fetches Vercel deployments and compares timestamps.",
      inputSchema: zodSchema(
        z.object({
          anomalyTimestamp: z.number().describe("Unix timestamp (ms) of the anomaly"),
          windowHours: z.number().default(2).describe("Hours before anomaly to search"),
        })
      ),
      execute: async (params: { anomalyTimestamp: number; windowHours: number }) => {
        try {
          const deployData = (await callDataSource("vercel", "data", {})) as Record<
            string,
            unknown
          > | null;
          if (!deployData) return { error: "Vercel not configured" };

          const deployments = (deployData.deployments ??
            deployData.recentDeployments ??
            []) as Array<{
            uid?: string;
            id?: string;
            name?: string;
            url?: string;
            created?: number;
            createdAt?: string;
            state?: string;
            meta?: { githubCommitMessage?: string };
          }>;

          const windowMs = params.windowHours * 3600000;
          const windowStart = params.anomalyTimestamp - windowMs;

          const correlated = deployments
            .filter((d) => {
              const ts = d.created
                ? d.created * 1000
                : d.createdAt
                  ? new Date(d.createdAt).getTime()
                  : 0;
              return ts >= windowStart && ts <= params.anomalyTimestamp;
            })
            .map((d) => ({
              id: d.uid ?? d.id,
              name: d.name,
              deployedAt: d.created ? new Date(d.created * 1000).toISOString() : d.createdAt,
              commitMessage: d.meta?.githubCommitMessage,
              timeBefore: `${Math.round((params.anomalyTimestamp - (d.created ? d.created * 1000 : new Date(d.createdAt ?? 0).getTime())) / 60000)}min before anomaly`,
            }));

          return {
            correlatedDeploys: correlated,
            found: correlated.length > 0,
            message:
              correlated.length > 0
                ? `Found ${correlated.length} deploy(s) within ${params.windowHours}h before the anomaly`
                : `No deployments found within ${params.windowHours}h before the anomaly`,
          };
        } catch {
          return { error: "Could not fetch deployment data" };
        }
      },
    }),

    // --- T5: Page Performance Analyzer (Round 8) ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    analyze_page_performance: (tool as any)({
      description:
        "Cross-reference search rankings (GSC) with page engagement (OpenPanel or Umami) to classify pages: winners, SEO bait (ranks but bounces), hidden gems (engages but no search), and underperformers.",
      inputSchema: zodSchema(
        z.object({
          range: z.enum(["7d", "15d", "30d", "3m"]).default("30d"),
        })
      ),
      execute: async (params: { range: string }) => {
        const [seoRaw, pagesRaw] = await Promise.all([
          callDataSource("google-search-console", "data", { range: params.range }),
          callAnalyticsDataSource("pages", { range: params.range }),
        ]);

        const seoData = (seoRaw as Record<string, unknown>)?.seo as
          | Record<string, unknown>
          | undefined;
        const queries = (seoData?.queries ?? []) as Array<{
          query: string;
          clicks: number;
          impressions: number;
          ctr: number;
          position: number;
          path?: string;
        }>;
        const pagesData = (pagesRaw as Record<string, unknown>)?.pages as
          | Array<{ path: string; sessions: number; bounce_rate: number; avg_duration: number }>
          | undefined;

        if (!queries.length && !pagesData?.length) {
          return { error: "No data available from GSC or OpenPanel" };
        }

        const classified = analyzePagePerformance(queries, pagesData ?? []);
        const summary = {
          winners: classified.filter((p) => p.category === "winner").length,
          seoBait: classified.filter((p) => p.category === "high-search-low-engagement").length,
          hiddenGems: classified.filter((p) => p.category === "low-search-high-engagement").length,
          underperformers: classified.filter((p) => p.category === "underperformer").length,
        };

        return { pages: classified, summary };
      },
    }),

    // --- T7: User Journey Analyzer (Round 8) ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    analyze_user_journey: (tool as any)({
      description:
        "Analyze user flow through the site using the connected analytics provider (OpenPanel or Umami): entry pages, most-visited pages, and exit points (high bounce). Identifies drop-off points and suggests improvements.",
      inputSchema: zodSchema(
        z.object({
          range: z.enum(["7d", "15d", "30d", "3m"]).default("30d"),
        })
      ),
      execute: async (params: { range: string }) => {
        const [pagesRaw, analyticsRaw] = await Promise.all([
          callAnalyticsDataSource("pages", { range: params.range }),
          callAnalyticsDataSource("data", { range: params.range }),
        ]);

        const pages = ((pagesRaw as Record<string, unknown>)?.pages ?? []) as Array<{
          path: string;
          title: string;
          sessions: number;
          bounce_rate: number;
          avg_duration: number;
        }>;
        const analytics = (analyticsRaw as Record<string, unknown>)?.analytics as
          | Record<string, unknown>
          | undefined;
        const referrers = (analytics?.referrers ?? []) as Array<{
          name: string | null;
          sessions: number;
        }>;

        if (!pages.length) return { error: "No page data available" };

        // Entry pages: high session count (likely landing pages)
        const entryPages = pages.slice(0, 5).map((p) => ({
          path: p.path,
          sessions: p.sessions,
          bounceRate: p.bounce_rate,
          role: p.bounce_rate > 70 ? "high-bounce entry" : "engaging entry",
        }));

        // Exit points: high bounce rate pages
        const exitPoints = [...pages]
          .sort((a, b) => b.bounce_rate - a.bounce_rate)
          .slice(0, 5)
          .map((p) => ({ path: p.path, bounceRate: p.bounce_rate, sessions: p.sessions }));

        // Top referrer sources
        const topReferrers = referrers
          .slice(0, 5)
          .map((r) => ({ source: r.name ?? "Direct", sessions: r.sessions }));

        return {
          journey: {
            entryPages,
            exitPoints,
            topReferrers,
            totalPages: pages.length,
          },
          insights: exitPoints
            .filter((p) => p.bounceRate > 70 && p.sessions > 10)
            .map(
              (p) =>
                `${p.path} has ${p.bounceRate}% bounce rate with ${p.sessions} sessions — consider improving content or internal links`
            ),
        };
      },
    }),

    // --- T7: Install Skill from URL (Round 9) ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    install_skill: (tool as any)({
      description:
        "Install a custom AI skill from a URL. Accepts GitHub URLs, raw markdown files, or skills.sh URLs. The skill becomes available in the next conversation.",
      inputSchema: zodSchema(
        z.object({
          url: z.string().describe("URL to the skill definition (markdown with frontmatter)"),
        })
      ),
      execute: async (params: { url: string }) => {
        try {
          const skill = await fetchSkillFromUrl(params.url);
          if (!skill)
            return {
              error:
                "Could not parse skill from URL. Expected markdown with ---name/description--- frontmatter.",
            };

          const { getLlmRepo } = await import("@/data/core/repository");
          const llmRepo = getLlmRepo();
          await llmRepo.upsertSkill({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            instructions: skill.instructions,
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          return {
            installed: true,
            skillId: skill.id,
            name: skill.name,
            description: skill.description,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to install skill" };
        }
      },
    }),

    // --- T9: List Skill Templates (Round 9) ---
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    list_skill_templates: (tool as any)({
      description:
        "List available skill templates that can be installed. Templates include: seo-expert, data-analyst, incident-responder.",
      inputSchema: zodSchema(emptyParam),
      execute: async () => {
        const { SKILL_TEMPLATES } = await import("@radarboard/llm/skills/templates");
        return {
          templates: SKILL_TEMPLATES.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
          })),
        };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    install_skill_template: (tool as any)({
      description:
        "Install a skill template by ID. Available: seo-expert, data-analyst, incident-responder.",
      inputSchema: zodSchema(
        z.object({
          templateId: z.string().describe("Template ID to install"),
        })
      ),
      execute: async (params: { templateId: string }) => {
        const { SKILL_TEMPLATES } = await import("@radarboard/llm/skills/templates");
        const template = SKILL_TEMPLATES.find((t) => t.id === params.templateId);
        if (!template) return { error: `Template "${params.templateId}" not found` };

        const { getLlmRepo } = await import("@/data/core/repository");
        const llmRepo = getLlmRepo();
        await llmRepo.upsertSkill({
          id: template.id,
          name: template.name,
          description: template.description,
          instructions: template.instructions,
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return { installed: true, skillId: template.id, name: template.name };
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Blueprint Tools
// ---------------------------------------------------------------------------

export function buildBlueprintTools() {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    list_layout_blueprints: (tool as any)({
      description:
        "List available layout blueprints. Returns pre-made dashboard layouts with widget assignments. Optionally filter by persona.",
      inputSchema: zodSchema(
        z.object({
          persona: z
            .string()
            .optional()
            .describe("Filter by persona ID (e.g. 'opensource', 'indie', 'seo')"),
        })
      ),
      execute: async (params: { persona?: string }) => {
        const { LAYOUT_BLUEPRINTS, scoreBlueprintFit } = await import(
          "@radarboard/widget-engine/blueprints/registry"
        );
        const blueprints = LAYOUT_BLUEPRINTS.map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          widgetCount: b.slots.length,
          widgets: b.slots.map((s) => s.widgetId),
          requiredIntegrations: b.requiredIntegrations,
          personaAffinities: b.personaAffinities,
          score: params.persona
            ? scoreBlueprintFit(b, {
                personas: [params.persona as never],
                connectedIntegrations: [],
              })
            : 0,
        }));
        return {
          blueprints: params.persona ? blueprints.sort((a, b) => b.score - a.score) : blueprints,
        };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    recommend_blueprint: (tool as any)({
      description:
        "Recommend the best layout blueprints based on a natural language description. Returns top 3 scored matches.",
      inputSchema: zodSchema(
        z.object({
          description: z
            .string()
            .describe(
              "What kind of dashboard the user wants (e.g. 'open source project tracking')"
            ),
        })
      ),
      execute: async (params: { description: string }) => {
        const { LAYOUT_BLUEPRINTS, scoreBlueprintFit } = await import(
          "@radarboard/widget-engine/blueprints/registry"
        );
        const desc = params.description.toLowerCase();

        // Simple keyword matching for persona inference
        const personaKeywords: Record<string, string[]> = {
          opensource: ["open source", "oss", "github", "stars", "community", "maintainer"],
          indie: ["indie", "solo", "saas", "revenue", "mrr", "bootstrapped"],
          seo: ["seo", "search", "ranking", "keyword", "organic"],
          marketing: ["marketing", "growth", "campaign", "conversion", "funnel"],
          devops: ["devops", "infrastructure", "deploy", "ci/cd", "monitoring", "ops"],
          mobile: ["mobile", "ios", "android", "app store", "react native"],
          "team-lead": ["team", "velocity", "sprint", "roadmap", "manager"],
          "content-creator": ["content", "blog", "newsletter", "audience", "creator"],
          data: ["data", "analytics", "dashboard", "metrics", "reporting"],
        };

        const matchedPersonas: string[] = [];
        for (const [persona, keywords] of Object.entries(personaKeywords)) {
          if (keywords.some((kw) => desc.includes(kw))) {
            matchedPersonas.push(persona);
          }
        }

        const scored = LAYOUT_BLUEPRINTS.map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          widgetCount: b.slots.length,
          widgets: b.slots.map((s) => `${s.widgetId} (${s.purpose})`),
          requiredIntegrations: b.requiredIntegrations,
          score: scoreBlueprintFit(b, {
            personas: matchedPersonas as never[],
            connectedIntegrations: [],
          }),
        }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        return { recommendations: scored, matchedPersonas };
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    apply_layout_blueprint: (tool as any)({
      description:
        "Apply a pre-made layout blueprint to a dashboard page. Sets both the grid structure and widget assignments. The user's dashboard will update on next refresh.",
      inputSchema: zodSchema(
        z.object({
          blueprintId: z.string().describe("Blueprint ID from list_layout_blueprints"),
          projectSlug: z
            .string()
            .nullable()
            .default(null)
            .describe("Project slug, or null for the all-projects view"),
          pageSlug: z
            .string()
            .default("overview")
            .describe("Dashboard page slug (default: overview)"),
        })
      ),
      execute: async (params: {
        blueprintId: string;
        projectSlug: string | null;
        pageSlug: string;
      }) => {
        const { executeApplyBlueprint } = await import(
          "@/lib/ai-actions/extensions/apply-blueprint"
        );
        return executeApplyBlueprint(params);
      },
    }),
  };
}

/**
 * Build dashboard write-tools — let the AI assemble the dashboard: list, add,
 * move, remove, and configure widgets, connect api-key integrations, and
 * suggest the next best setup steps. Changes persist server-side; the user's
 * dashboard reflects them on next refresh.
 */
export function buildDashboardTools() {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    list_widgets: (tool as any)({
      description:
        "List all installed widgets with their IDs, what integrations they need, and which dashboard scopes they support. Call this before add_widget to choose valid widget IDs.",
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const { executeListWidgets } = await import("@/lib/ai-actions/dashboard/list-widgets");
        return executeListWidgets();
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    add_widget: (tool as any)({
      description:
        "Add a widget to the dashboard. Places it in the first empty cell of the page's layout, or in a specific cell (replacing any occupant). Use list_widgets for valid widget IDs.",
      inputSchema: zodSchema(
        z.object({
          widgetId: z.string().describe("Widget ID from list_widgets, e.g. 'revenue'"),
          projectSlug: z
            .string()
            .nullable()
            .default(null)
            .describe("Project slug, or null for the all-projects view"),
          pageSlug: z.string().default("overview").describe("Dashboard page slug"),
          cellId: z
            .string()
            .optional()
            .describe("Target cell (e.g. 'cell-3'); omit to use the first empty cell"),
        })
      ),
      execute: async (params: {
        widgetId: string;
        projectSlug: string | null;
        pageSlug: string;
        cellId?: string;
      }) => {
        const { executeAddWidget } = await import("@/lib/ai-actions/dashboard/add-widget");
        const result = await executeAddWidget(params);
        return result.added ? { ...result, dashboardChanged: true } : result;
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    move_widget: (tool as any)({
      description:
        "Move a widget to a different cell on the same page, swapping with any occupant.",
      inputSchema: zodSchema(
        z.object({
          widgetId: z.string().describe("Widget ID to move"),
          toCellId: z.string().describe("Destination cell ID, e.g. 'cell-2'"),
          projectSlug: z.string().nullable().default(null),
          pageSlug: z.string().default("overview"),
        })
      ),
      execute: async (params: {
        widgetId: string;
        toCellId: string;
        projectSlug: string | null;
        pageSlug: string;
      }) => {
        const { executeMoveWidget } = await import("@/lib/ai-actions/dashboard/add-widget");
        const result = await executeMoveWidget(params);
        return result.moved ? { ...result, dashboardChanged: true } : result;
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    remove_widget: (tool as any)({
      description:
        "Remove a widget from the dashboard, leaving the cell empty. Target a specific cell or the first cell holding a given widget.",
      inputSchema: zodSchema(
        z.object({
          projectSlug: z.string().nullable().default(null),
          pageSlug: z.string().default("overview"),
          cellId: z.string().optional().describe("Cell to clear"),
          widgetId: z.string().optional().describe("Or: remove the first cell holding this widget"),
        })
      ),
      execute: async (params: {
        projectSlug: string | null;
        pageSlug: string;
        cellId?: string;
        widgetId?: string;
      }) => {
        const { executeRemoveWidget } = await import("@/lib/ai-actions/dashboard/remove-widget");
        const result = await executeRemoveWidget(params);
        return result.removed ? { ...result, dashboardChanged: true } : result;
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    configure_widget: (tool as any)({
      description:
        "Set config options for a widget (merged into its existing config, or replacing it). Config is global per widget ID.",
      inputSchema: zodSchema(
        z.object({
          widgetId: z.string().describe("Widget ID to configure"),
          config: z.record(z.string(), z.unknown()).describe("Config keys to set"),
          mode: z.enum(["merge", "replace"]).default("merge"),
        })
      ),
      execute: async (params: {
        widgetId: string;
        config: Record<string, unknown>;
        mode: "merge" | "replace";
      }) => {
        const { executeConfigureWidget } = await import(
          "@/lib/ai-actions/dashboard/configure-widget"
        );
        const result = await executeConfigureWidget(params);
        return result.configured ? { ...result, dashboardChanged: true } : result;
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    connect_integration: (tool as any)({
      description:
        "Connect an api-key integration by testing and saving its credentials. Only works for api-key auth — OAuth integrations must be connected from Settings. The credential is shared across all integrations of the same provider.",
      inputSchema: zodSchema(
        z.object({
          integrationId: z.string().describe("Integration ID, e.g. 'revenuecat'"),
          values: z
            .record(z.string(), z.string())
            .describe("Credential field values, e.g. { apiKey: 'sk_...' }"),
        })
      ),
      execute: async (params: { integrationId: string; values: Record<string, string> }) => {
        const { executeConnectIntegration } = await import(
          "@/lib/ai-actions/dashboard/connect-integration"
        );
        return executeConnectIntegration(params);
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    create_rest_integration: (tool as any)({
      description:
        "Create a no-code REST integration from a declarative config, then register it live so its data can be fetched immediately. Use this to scaffold a new integration for any HTTPS REST API. baseUrl must be https (http is only allowed for localhost). Paths and query values support {projectSlug}, {range}, and {timeZone} placeholders. Re-using an existing user integration id updates it.",
      inputSchema: zodSchema(
        z.object({
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
                .describe(
                  "Authorization header scheme applied with the token (defaults to 'bearer')"
                ),
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
              testPath: z
                .string()
                .optional()
                .describe("Path hit to validate credentials, e.g. '/me'"),
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
        })
      ),
      execute: async (params: {
        id: string;
        name: string;
        description: string;
        category: "revenue" | "deployment" | "analytics" | "monitoring" | "communication";
        baseUrl: string;
        icon?: string;
        provider?: string;
        apiDocsUrl?: string;
        auth?: {
          scheme?: "bearer" | "token" | "basic" | "none";
          tokenField?: string;
          fields?: Array<{
            key: string;
            label: string;
            type: "text" | "password";
            optional?: boolean;
          }>;
          testPath?: string;
          docsUrl?: string;
        };
        dataSources: Array<{
          action: string;
          description: string;
          cacheTtlSeconds: number;
          path: string;
          method?: "GET" | "POST";
          query?: Record<string, string>;
        }>;
      }) => {
        const { executeCreateIntegration } = await import(
          "@/lib/ai-actions/dashboard/connect-integration"
        );
        return executeCreateIntegration(params);
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    suggest_setup: (tool as any)({
      description:
        "Suggest the best next setup steps: widgets ready to add (their integrations are connected) and integrations worth connecting (they'd unlock widgets). Use this to guide a user through building a useful dashboard fast.",
      inputSchema: zodSchema(
        z.object({
          projectSlug: z.string().nullable().default(null),
        })
      ),
      execute: async (params: { projectSlug: string | null }) => {
        const { executeSuggestSetup } = await import("@/lib/ai-actions/dashboard/suggest-setup");
        return executeSuggestSetup(params);
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    find_integration_options: (tool as any)({
      description:
        "Discover how to connect a named service (e.g. 'stripe', 'sentry'). Read-only. Returns candidates across four rungs: an existing registered integration, a known MCP server, an installable community extension, and the always-available no-code REST fallback — plus a recommended rung. Call plan_integration_setup for a concrete proposal.",
      inputSchema: zodSchema(
        z.object({
          service: z.string().describe("Service name to look up, e.g. 'stripe'"),
        })
      ),
      execute: async (params: { service: string }) => {
        const { executeFindOptions } = await import("@/lib/ai-actions/integrations/find-options");
        return executeFindOptions(params);
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    plan_integration_setup: (tool as any)({
      description:
        "Plan how to set up a service end to end (the setup ladder orchestrator). Read-only. Picks the best rung and returns a human-readable proposal plus an actionSpec naming the executor tool (connect_integration / connect_mcp_server / create_rest_integration) and what the user must still provide. ALWAYS present the proposal and get the user's approval before calling the executor.",
      inputSchema: zodSchema(
        z.object({
          service: z.string().describe("Service the user wants to connect, e.g. 'sentry'"),
        })
      ),
      execute: async (params: { service: string }) => {
        const { executePlanSetup } = await import("@/lib/ai-actions/integrations/plan-setup");
        return executePlanSetup(params);
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    connect_mcp_server: (tool as any)({
      description:
        "Connect an external MCP server as a data source. Confirm-gated: it opens outbound network egress, so present the server (name, url, whether it needs a token) and only call with confirmedByUser: true after the user approves. https only (http allowed for localhost); streamable-http transport only. It runs a live handshake and only saves if the server responds — a bad url/token fails instead of saving. Once connected, the server's tools become available to you on the next turn.",
      inputSchema: zodSchema(
        z.object({
          name: z
            .string()
            .describe("Server slug: lowercase letters, numbers, - and _, e.g. 'sentry'"),
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
        })
      ),
      execute: async (params: {
        name: string;
        url: string;
        authHeader?: string;
        docsUrl?: string;
        enabled: boolean;
        confirmedByUser: boolean;
      }) => {
        const { executeConnectMcp } = await import("@/lib/ai-actions/integrations/connect-mcp");
        return executeConnectMcp(params);
      },
    }),

    // biome-ignore lint/suspicious/noExplicitAny: tool() overload strictness
    show_rest_data: (tool as any)({
      description:
        "Render a REST integration's data on the dashboard: places the generic 'REST Data' widget and maps the integration's response fields onto KPIs and an optional list. Use after create_rest_integration/connect_integration to make its data visible. Fields are dot-paths into the JSON response (e.g. 'stats.activeUsers', 'items'). Note: one REST Data binding is active at a time.",
      inputSchema: zodSchema(
        z.object({
          integrationId: z.string().describe("Integration id to display, e.g. 'acme-analytics'"),
          action: z
            .string()
            .default("data")
            .describe("Data-source action on that integration, e.g. 'summary'"),
          metrics: z
            .array(
              z.object({
                label: z.string(),
                field: z.string().describe("Dot-path to a value, e.g. 'stats.activeUsers'"),
                format: z
                  .enum([
                    "currency",
                    "number",
                    "percent",
                    "date",
                    "relative-time",
                    "duration-seconds",
                  ])
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
        })
      ),
      execute: async (params: {
        integrationId: string;
        action: string;
        metrics?: Array<{
          label: string;
          field: string;
          format?:
            | "currency"
            | "number"
            | "percent"
            | "date"
            | "relative-time"
            | "duration-seconds";
        }>;
        list?: { field: string; title: string; subtitle?: string; emptyMessage?: string };
        projectSlug: string | null;
        pageSlug: string;
        cellId?: string;
      }) => {
        const { executePlaceRestWidget } = await import(
          "@/lib/ai-actions/integrations/place-rest-widget"
        );
        return executePlaceRestWidget(params);
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract numeric values from an integration data response.
 * Walks the response looking for arrays of numbers or objects with numeric values.
 */
function extractNumericValues(data: unknown): number[] {
  if (!data || typeof data !== "object") return [];

  // Direct array of numbers
  if (Array.isArray(data)) {
    const nums = data.filter((v): v is number => typeof v === "number");
    if (nums.length > 0) return nums;

    // Array of objects with a "value" field
    const withValues = data
      .map((item) =>
        typeof item === "object" && item !== null && "value" in item
          ? Number((item as Record<string, unknown>).value)
          : Number.NaN
      )
      .filter((n) => !Number.isNaN(n));
    if (withValues.length > 0) return withValues;
  }

  // Walk object looking for first numeric array
  const record = data as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (Array.isArray(val)) {
      const result = extractNumericValues(val);
      if (result.length > 0) return result;
    }
    if (typeof val === "object" && val !== null) {
      const result = extractNumericValues(val);
      if (result.length > 0) return result;
    }
  }

  return [];
}
