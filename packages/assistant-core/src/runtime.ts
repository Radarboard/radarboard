import type {
  AssistantArtifactRow,
  AssistantMode,
  LlmRepository,
} from "@radarboard/types/database";
import { isWorkflowMode, selectDependencyArtifacts } from "./assistant-workflows";

export function scopeProjectContext(
  fullMap: Record<string, unknown>,
  pinnedProject: string | null
): Record<string, unknown> {
  if (!pinnedProject) return fullMap;
  const ctx = fullMap[pinnedProject];
  return ctx ? { [pinnedProject]: ctx } : fullMap;
}

export function dedupeArtifacts(artifacts: AssistantArtifactRow[]): AssistantArtifactRow[] {
  const seen = new Set<string>();
  return artifacts
    .filter((artifact) => {
      if (seen.has(artifact.id)) return false;
      seen.add(artifact.id);
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadDependencyArtifacts(params: {
  llmRepo: LlmRepository;
  mode: AssistantMode;
  projectSlug: string | null;
  conversationId: string;
  artifactId: string | null;
}): Promise<AssistantArtifactRow[]> {
  if (!isWorkflowMode(params.mode) && !params.artifactId) return [];

  const [projectArtifacts, conversationArtifacts, selectedArtifact] = await Promise.all([
    params.projectSlug
      ? params.llmRepo.listArtifacts({ projectSlug: params.projectSlug, limit: 12 }).catch(() => [])
      : Promise.resolve([]),
    params.llmRepo
      .listArtifacts({ sourceConversationId: params.conversationId, limit: 12 })
      .catch(() => []),
    params.artifactId ? params.llmRepo.getArtifact(params.artifactId).catch(() => null) : null,
  ]);

  const merged = dedupeArtifacts([
    ...(selectedArtifact ? [selectedArtifact] : []),
    ...conversationArtifacts,
    ...projectArtifacts,
  ]);
  return selectDependencyArtifacts(params.mode, merged, params.artifactId);
}

export function hasAgentBrowserTools(mcpTools: Record<string, unknown>): boolean {
  return Object.keys(mcpTools).some((toolName) => toolName.startsWith("agent-browser__"));
}
