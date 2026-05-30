import "@/lib/integrations-init";
import "@/lib/widgets-init";
import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { createLogger } from "@radarboard/logger/logger";
import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import {
  auditCapabilityGovernance,
  formatCapabilityLabel,
  getCanonicalWidgetMap,
} from "@/lib/extensions/capability-governance";

const log = createLogger("api/extensions/dependency-graph");

interface GraphNode {
  id: string;
  name: string;
  type: "integration" | "plugin" | "widget";
  category?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

function collectIntegrationNodesAndEdges(
  integrations: ReturnType<typeof getAllIntegrations>,
  canonicalByCapability: ReturnType<typeof getCanonicalWidgetMap>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const integration of integrations) {
    nodes.push({
      id: `integration:${integration.id}`,
      name: integration.name,
      type: "integration",
      category: integration.category,
    });

    for (const capability of integration.capabilities ?? []) {
      const owner = canonicalByCapability.get(capability.id);
      if (!owner) continue;
      edges.push({
        source: `integration:${integration.id}`,
        target: `widget:${owner.widget.id}`,
        label: `provides ${formatCapabilityLabel(capability.id)}`,
      });
    }
  }

  return { nodes, edges };
}

function collectPluginNodesAndEdges(plugins: ReturnType<typeof getAllPlugins>): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const plugin of plugins) {
    nodes.push({
      id: `plugin:${plugin.id}`,
      name: plugin.name,
      type: "plugin",
      category: plugin.category,
    });

    for (const dep of plugin.requiredIntegrations ?? []) {
      edges.push({
        source: `plugin:${plugin.id}`,
        target: `integration:${dep}`,
        label: "requires",
      });
    }

    for (const dep of plugin.dependencies ?? []) {
      edges.push({
        source: `plugin:${plugin.id}`,
        target: `plugin:${dep}`,
        label: "depends on",
      });
    }

    for (const intent of plugin.intents ?? []) {
      for (const other of plugins) {
        if (other.id === plugin.id) continue;
        const handles = other.intents?.some((entry) => entry.action === intent.action);
        if (!handles) continue;
        edges.push({
          source: `plugin:${plugin.id}`,
          target: `plugin:${other.id}`,
          label: `intent: ${intent.action}`,
        });
      }
    }
  }

  return { nodes, edges };
}

function collectWidgetNodesAndEdges(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const [, widget] of WIDGET_REGISTRY) {
    nodes.push({ id: `widget:${widget.id}`, name: widget.name, type: "widget" });

    for (const dep of widget.requiredIntegrations ?? []) {
      edges.push({
        source: `widget:${widget.id}`,
        target: `integration:${dep}`,
        label: "requires",
      });
    }
  }

  return { nodes, edges };
}

export async function handleGetDependencyGraph() {
  try {
    const integrations = getAllIntegrations();
    const widgets = Array.from(WIDGET_REGISTRY.values());
    const canonicalByCapability = getCanonicalWidgetMap(widgets);
    const plugins = getAllPlugins();
    const integrationGraph = collectIntegrationNodesAndEdges(integrations, canonicalByCapability);
    const pluginGraph = collectPluginNodesAndEdges(plugins);
    const widgetGraph = collectWidgetNodesAndEdges();
    const nodes = [...integrationGraph.nodes, ...pluginGraph.nodes, ...widgetGraph.nodes];
    const edges = [...integrationGraph.edges, ...pluginGraph.edges, ...widgetGraph.edges];

    const audits = auditCapabilityGovernance(integrations, widgets);

    return NextResponse.json({
      nodes,
      edges,
      audits,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        integrations: nodes.filter((n) => n.type === "integration").length,
        plugins: nodes.filter((n) => n.type === "plugin").length,
        widgets: nodes.filter((n) => n.type === "widget").length,
      },
    });
  } catch (err) {
    log.error("Failed to build dependency graph", { error: err });
    return errorJson(500, err instanceof Error ? err.message : "Failed to build graph");
  }
}
