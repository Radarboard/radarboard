/**
 * AI Action: Suggest next actions based on conversation context.
 *
 * Generates 3-5 actionable suggestions based on what was discussed,
 * including available tools the user could invoke next.
 */

export interface SuggestionContext {
  hasAnomalies: boolean;
  hasTrends: boolean;
  hasComparisons: boolean;
  integrations: string[];
  recentToolCalls: string[];
}

export interface ActionSuggestion {
  action: string;
  description: string;
  toolId: string;
}

export function suggestNextActions(context: SuggestionContext): ActionSuggestion[] {
  const suggestions: ActionSuggestion[] = [];

  if (context.hasAnomalies) {
    suggestions.push({
      action: "Create an issue for the anomaly",
      description: "File a Linear or GitHub issue to track and investigate the detected anomaly.",
      toolId: "create_linear_issue",
    });
    suggestions.push({
      action: "Set up an alert workflow",
      description: "Create a workflow to automatically notify when this metric anomaly recurs.",
      toolId: "create_workflow",
    });
    if (!context.recentToolCalls.includes("diagnose_metric")) {
      suggestions.push({
        action: "Diagnose root cause",
        description: "Cross-reference this anomaly with other metrics and recent deploys.",
        toolId: "diagnose_metric",
      });
    }
  }

  if (context.hasTrends && !context.recentToolCalls.includes("compare_metrics")) {
    suggestions.push({
      action: "Compare with related metrics",
      description: "See how this trend correlates with other integration metrics.",
      toolId: "compare_metrics",
    });
  }

  if (!context.recentToolCalls.includes("export_report")) {
    suggestions.push({
      action: "Export this analysis",
      description: "Generate a shareable markdown report of the current analysis.",
      toolId: "export_report",
    });
  }

  if (!context.recentToolCalls.includes("generate_daily_briefing")) {
    suggestions.push({
      action: "Generate daily briefing",
      description: "Get a comprehensive status summary across all connected integrations.",
      toolId: "generate_daily_briefing",
    });
  }

  if (context.integrations.length > 2 && !context.recentToolCalls.includes("scan_correlations")) {
    suggestions.push({
      action: "Scan for correlations",
      description: "Discover which metrics move together across your integrations.",
      toolId: "scan_correlations",
    });
  }

  // Return top 5 suggestions
  return suggestions.slice(0, 5);
}
