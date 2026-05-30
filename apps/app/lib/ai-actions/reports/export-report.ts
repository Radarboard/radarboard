/**
 * AI Action: Export a conversation analysis as a markdown report.
 *
 * Reports are persisted as assistant artifacts (mode: "report") in the
 * LLM repository. This ensures they survive server restarts.
 * Falls back to in-memory storage if DB is unavailable.
 */

import { getLlmRepo } from "@/data/core/repository";

export interface ReportSection {
  title: string;
  content: string;
}

export interface ExportedReport {
  id: string;
  title: string;
  markdown: string;
  generatedAt: number;
}

// In-memory fallback for when DB is unavailable
const GLOBAL_KEY = "__radarboard_reports__" as const;

function getMemoryStore(): Map<string, ExportedReport> {
  const g = globalThis as unknown as Record<string, Map<string, ExportedReport>>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map();
  return g[GLOBAL_KEY];
}

export async function generateReport(
  title: string,
  sections: ReportSection[]
): Promise<ExportedReport> {
  const now = Date.now();
  const lines: string[] = [`# ${title}`, "", `*Generated: ${new Date().toISOString()}*`, ""];
  for (const section of sections) {
    lines.push(`## ${section.title}`, "", section.content, "");
  }

  const report: ExportedReport = {
    id: crypto.randomUUID(),
    title,
    markdown: lines.join("\n"),
    generatedAt: now,
  };

  // Persist as artifact
  try {
    const llmRepo = getLlmRepo();
    await llmRepo.upsertArtifact({
      id: report.id,
      projectSlug: null,
      mode: "review",
      title: report.title,
      summary: `Exported report: ${title}`,
      body: report.markdown,
      contentType: "markdown",
      status: "completed",
      sourceConversationId: null,
      createdAt: new Date(now).toISOString(),
      nextMode: null,
      nextReason: null,
      evidenceRefs: [],
    });
  } catch {
    // DB unavailable — memory is the only store
  }

  // Always cache in memory for fast reads
  getMemoryStore().set(report.id, report);
  return report;
}

export async function getReport(id: string): Promise<ExportedReport | null> {
  // Try DB first
  try {
    const llmRepo = getLlmRepo();
    const artifact = await llmRepo.getArtifact(id);
    if (artifact) {
      return {
        id: artifact.id,
        title: artifact.title,
        markdown: artifact.body,
        generatedAt: new Date(artifact.createdAt).getTime(),
      };
    }
  } catch {
    // Fallback to memory
  }

  // Check memory store
  const store = getMemoryStore();
  return store.get(id) ?? null;
}

export async function listReports(): Promise<ExportedReport[]> {
  try {
    const llmRepo = getLlmRepo();
    const artifacts = await llmRepo.listArtifacts({ mode: "review", limit: 50 });
    // Filter to only report-style artifacts (have "Exported report" in summary)
    return artifacts
      .filter((a) => a.summary?.startsWith("Exported report:"))
      .map((a) => ({
        id: a.id,
        title: a.title,
        markdown: a.body,
        generatedAt: new Date(a.createdAt).getTime(),
      }))
      .sort((a, b) => b.generatedAt - a.generatedAt);
  } catch {
    // Fallback to memory
    return Array.from(getMemoryStore().values()).sort((a, b) => b.generatedAt - a.generatedAt);
  }
}

/** Reset store (for testing). */
export function resetReportStore(): void {
  const g = globalThis as unknown as Record<string, undefined>;
  g[GLOBAL_KEY] = undefined;
}
