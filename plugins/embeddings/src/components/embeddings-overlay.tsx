"use client";

import { PluginListHeader } from "@radarboard/plugin-sdk/components/list-header";
import { PluginListTabs } from "@radarboard/plugin-sdk/components/list-tabs";
import { PluginEmptyState } from "@radarboard/plugin-sdk/components/plugin-empty";
import { PluginSearchInput } from "@radarboard/plugin-sdk/components/plugin-search";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { Button } from "@radarboard/ui/button";
import { Database, Layers, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Tab = "clusters" | "sources" | "search";

const TABS = [
  { value: "clusters" as Tab, label: "Clusters" },
  { value: "sources" as Tab, label: "Sources" },
  { value: "search" as Tab, label: "Search" },
];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchEmbeddingsApi(body: Record<string, unknown>) {
  const res = await fetch(API_ROUTES.embeddings, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Main overlay
// ---------------------------------------------------------------------------

export function EmbeddingsOverlay(_props: PluginRenderProps) {
  const [tab, setTab] = useState<Tab>("clusters");

  return (
    <div className="flex h-full flex-col">
      <PluginListHeader label="Embeddings & Clustering" />
      <PluginListTabs tabs={TABS} value={tab} onChange={setTab} />

      <div className="flex-1 overflow-auto p-4">
        {tab === "clusters" && <ClustersTab />}
        {tab === "sources" && <SourcesTab />}
        {tab === "search" && <SearchTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clusters Tab
// ---------------------------------------------------------------------------

interface ClusterData {
  id: string;
  label: string;
  itemCount: number;
  items: Array<{ text: string; source: string; sourceId: string; similarity: number }>;
}

function ClustersTab() {
  const [clusters, setClusters] = useState<ClusterData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateClusters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchEmbeddingsApi({ action: "cluster", numClusters: 5 });
      setClusters(result.clusters ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate clusters");
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-dim">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="font-mono text-w-sm">Clustering embeddings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="rounded-item border border-destructive/30 bg-destructive/5 p-3 font-mono text-destructive text-w-sm">
          {error}
        </div>
        <Button
          type="button"
          onClick={generateClusters}
          variant="link"
          uppercase={false}
          className="px-0 text-primary text-w-sm"
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!clusters) {
    return (
      <PluginEmptyState
        title="Topic Clusters"
        description="Generate topic clusters from your embedded data. Clusters group semantically similar items using K-means++ clustering."
        action={{ label: "Generate Clusters", onClick: generateClusters }}
      />
    );
  }

  if (clusters.length === 0) {
    return (
      <PluginEmptyState
        title="No Embeddings Found"
        description="No embedded data to cluster. Enable auto-embed for your sources or use the assistant to embed content first."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-dim text-w-sm">{clusters.length} clusters</span>
        <Button
          type="button"
          onClick={generateClusters}
          variant="link"
          size="xs"
          uppercase={false}
          className="px-0 text-primary"
        >
          Regenerate
        </Button>
      </div>
      {clusters.map((cluster) => (
        <ClusterCard key={cluster.id} cluster={cluster} />
      ))}
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: ClusterData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-item border border-border">
      <Button
        type="button"
        onClick={() => setExpanded(!expanded)}
        variant="ghost"
        uppercase={false}
        fullWidth
        className="h-auto justify-between p-3 text-left"
      >
        <div>
          <div className="font-mono text-foreground text-w-sm">{cluster.label}</div>
          <div className="text-dim text-w-xs">{cluster.itemCount} items</div>
        </div>
        <span className="text-dim text-w-xs">{expanded ? "▲" : "▼"}</span>
      </Button>
      {expanded && (
        <div className="space-y-1 border-border border-t px-3 py-2">
          {cluster.items.slice(0, 15).map((item) => (
            <div
              key={`${item.source}:${item.sourceId}`}
              className="flex items-center justify-between py-0.5"
            >
              <span className="truncate font-mono text-foreground text-w-xs">{item.text}</span>
              <span className="ml-2 shrink-0 font-mono text-dim text-w-xs">
                {(item.similarity * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources Tab
// ---------------------------------------------------------------------------

interface SourceSummary {
  id: string;
  count: number;
}

const AVAILABLE_SOURCES = [
  { id: "gsc", name: "Google Search Console", description: "Search queries", icon: Search },
  {
    id: "github-issues",
    name: "GitHub Issues",
    description: "Issue titles & bodies",
    icon: Database,
  },
  { id: "linear", name: "Linear Issues", description: "Issue titles & descriptions", icon: Layers },
];

function SourcesTab() {
  const [sourcesState, setSourcesState] = useState<{
    loading: boolean;
    sources: SourceSummary[];
    totalCount: number;
  }>({
    loading: true,
    sources: [],
    totalCount: 0,
  });

  useEffect(() => {
    fetchEmbeddingsApi({ action: "list" })
      .then((result) => {
        const bySource: Record<string, number> = {};
        for (const row of result.rows ?? []) {
          bySource[row.source] = (bySource[row.source] ?? 0) + 1;
        }
        setSourcesState({
          loading: false,
          sources: Object.entries(bySource).map(([id, count]) => ({ id, count })),
          totalCount: result.count ?? 0,
        });
      })
      .catch(() => {
        setSourcesState({
          loading: false,
          sources: [],
          totalCount: 0,
        });
      });
  }, []);

  const getCount = (sourceId: string) =>
    sourcesState.sources.find((source) => source.id === sourceId)?.count ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-dim text-w-sm">
          Embedded data sources. Embeddings are generated when data is refreshed.
        </p>
        {sourcesState.totalCount > 0 && (
          <span className="font-mono text-dim text-w-xs">{sourcesState.totalCount} total</span>
        )}
      </div>
      {AVAILABLE_SOURCES.map((source) => {
        const count = getCount(source.id);
        return (
          <div
            key={source.id}
            className="flex items-center justify-between rounded-item border border-border p-3"
          >
            <div className="flex items-center gap-3">
              <source.icon className="h-4 w-4 text-dim" />
              <div>
                <div className="font-mono text-foreground text-w-sm">{source.name}</div>
                <div className="text-dim text-w-xs">{source.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <span className="rounded-item bg-secondary px-2 py-0.5 font-mono text-foreground-secondary text-w-xs">
                  {count} embedded
                </span>
              )}
              {sourcesState.loading ? <Loader2 className="h-3 w-3 animate-spin text-dim" /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search Tab
// ---------------------------------------------------------------------------

interface SearchResult {
  text: string;
  source: string;
  sourceId: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const result = await fetchEmbeddingsApi({
        action: "find_similar",
        query: query.trim(),
        limit: 20,
      });
      setResults(result.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <PluginSearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search semantically across all embedded content..."
          className="flex-1 font-mono"
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
        />
        <Button
          type="button"
          variant="default"
          size="lg"
          uppercase={false}
          onClick={runSearch}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {results === null && (
        <p className="text-dim text-w-xs">
          Semantic search finds content by meaning, not just keywords. Results are ranked by cosine
          similarity to your query's embedding vector.
        </p>
      )}

      {results !== null && results.length === 0 && (
        <p className="py-4 text-center font-mono text-dim text-w-sm">
          No matching embeddings found. Try a different query or embed more content.
        </p>
      )}

      {results !== null && results.length > 0 && (
        <div className="space-y-1">
          <div className="font-mono text-dim text-w-xs">{results.length} results</div>
          {results.map((r) => (
            <div
              key={`${r.source}:${r.sourceId}:${r.text}`}
              className="flex items-center justify-between rounded-item border border-border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-foreground text-w-sm">{r.text}</div>
                <div className="text-dim text-w-xs">
                  {r.source} / {r.sourceId}
                </div>
              </div>
              <span className="ml-2 shrink-0 rounded-item bg-secondary px-2 py-0.5 font-mono text-foreground-secondary text-w-xs">
                {(r.similarity * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
