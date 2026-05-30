/**
 * Auto-embed hook — automatically generates embeddings for integration data
 * when fresh data is fetched from supported sources.
 *
 * Called from the unified integration route after a fresh (non-stale) fetch.
 * Runs asynchronously in the background to avoid blocking the response.
 */

import { createLogger } from "@radarboard/logger/logger";
import { getPluginRepo } from "@/data/core/repository";
import { getEmbeddingService } from "@/lib/embedding-service-singleton";

const log = createLogger("auto-embed");

const PLUGIN_ID = "embeddings";
const SETTINGS_KEY = "embeddings:settings";

/** Integration → source ID mapping for embedding. */
const INTEGRATION_SOURCE_MAP: Record<string, string> = {
  "google-search-console": "gsc",
  github: "github-issues",
  linear: "linear",
};

/** Integration + action → data key containing embeddable items. */
const EMBEDDABLE_ACTIONS: Record<string, Record<string, true>> = {
  "google-search-console": { data: true },
  github: { "open-issues": true, data: true },
  linear: { data: true },
};

interface EmbeddingsSettings {
  enabled?: boolean;
  modelId?: string;
  customModelId?: string;
  providerId?: string;
  dimensions?: number;
  autoEmbedSources?: string[];
}

async function getSettings(): Promise<EmbeddingsSettings> {
  try {
    const repo = getPluginRepo();
    const raw = await repo.get(PLUGIN_ID, SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as EmbeddingsSettings) : {};
  } catch {
    return {};
  }
}

/**
 * Check if auto-embed should run for this integration/action, and if so,
 * embed the items in the background.
 */
export function maybeAutoEmbed(
  integration: string,
  action: string,
  data: unknown,
  projectSlug: string | null
): void {
  const sourceId = INTEGRATION_SOURCE_MAP[integration];
  if (!sourceId) return;

  const actions = EMBEDDABLE_ACTIONS[integration];
  if (!actions?.[action]) return;

  // Fire and forget — don't block the response
  runAutoEmbed(sourceId, integration, data, projectSlug).catch((err) => {
    log.error("Auto-embed failed", { sourceId, error: err });
  });
}

async function runAutoEmbed(
  sourceId: string,
  integration: string,
  data: unknown,
  projectSlug: string | null
): Promise<void> {
  const settings = await getSettings();

  if (!settings.enabled) return;

  // Check if this source is in the auto-embed list
  if (settings.autoEmbedSources && settings.autoEmbedSources.length > 0) {
    if (!settings.autoEmbedSources.includes(sourceId)) return;
  }

  const effectiveModelId = settings.customModelId?.trim() || settings.modelId;
  const service = await getEmbeddingService({
    modelId: effectiveModelId,
    providerId: settings.providerId !== "auto" ? settings.providerId : undefined,
    dimensions: settings.dimensions && settings.dimensions > 0 ? settings.dimensions : undefined,
  });
  if (!service) return;

  const items = extractEmbeddableItems(sourceId, integration, data);
  if (items.length === 0) return;

  log.info(`Auto-embedding ${items.length} items from ${sourceId}`, { projectSlug });

  await service.embedAndStoreBatch(
    items.map((item) => ({
      source: sourceId,
      sourceId: item.id,
      text: item.text,
      projectSlug,
      metadata: item.metadata,
    }))
  );

  log.info(`Auto-embedded ${items.length} items from ${sourceId}`, { projectSlug });
}

interface EmbeddableItem {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

function extractEmbeddableItems(
  sourceId: string,
  _integration: string,
  data: unknown
): EmbeddableItem[] {
  if (typeof data !== "object" || data === null) return [];

  switch (sourceId) {
    case "gsc":
      return extractGscQueries(data);
    case "github-issues":
      return extractGithubIssues(data);
    case "linear":
      return extractLinearIssues(data);
    default:
      return [];
  }
}

function extractGscQueries(data: unknown): EmbeddableItem[] {
  const payload = data as Record<string, unknown>;
  const seo = payload.seo as Record<string, unknown> | undefined;
  if (!seo) return [];

  const queries = seo.queries as
    | Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>
    | undefined;
  if (!Array.isArray(queries)) return [];

  return queries
    .filter((q) => q.query && q.query.length > 0)
    .map((q) => ({
      id: `query:${q.query}`,
      text: q.query,
      metadata: {
        clicks: q.clicks,
        impressions: q.impressions,
        ctr: q.ctr,
        position: q.position,
      },
    }));
}

function extractGithubIssues(data: unknown): EmbeddableItem[] {
  const payload = data as Record<string, unknown>;
  const items = payload.items as
    | Array<{
        id: number;
        number: number;
        title: string;
        repo: string;
        labels?: Array<{ name: string }>;
      }>
    | undefined;
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => item.title && item.title.length > 0)
    .map((item) => ({
      id: `issue:${item.repo}#${item.number}`,
      text: item.title,
      metadata: {
        repo: item.repo,
        number: item.number,
        labels: item.labels?.map((l) => l.name) ?? [],
      },
    }));
}

function extractLinearIssues(data: unknown): EmbeddableItem[] {
  const payload = data as Record<string, unknown>;
  const items = payload.items as
    | Array<{ id: string; identifier: string; title: string; url?: string }>
    | undefined;
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => item.title && item.title.length > 0)
    .map((item) => ({
      id: `linear:${item.identifier}`,
      text: item.title,
      metadata: {
        identifier: item.identifier,
        url: item.url,
      },
    }));
}
