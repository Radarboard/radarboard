import { selectSkillsForMode } from "@radarboard/assistant-core/assistant-workflows";
import { detectTopicSkills, recallMemories } from "@radarboard/assistant-core/chat-helpers";
import {
  hasAgentBrowserTools as coreHasAgentBrowserTools,
  loadDependencyArtifacts as coreLoadDependencyArtifacts,
} from "@radarboard/assistant-core/runtime";
import {
  type AttachedNoteRecord,
  buildAttachedContextSections as coreBuildAttachedContextSections,
  buildContextDebugMetadata as coreBuildContextDebugMetadata,
  buildMemoryDebugMetadata as coreBuildMemoryDebugMetadata,
  buildToolOriginMap as coreBuildToolOriginMap,
  extractLastUserText as coreExtractLastUserText,
  loadAllSkills as coreLoadAllSkills,
  loadPersistedRuntimeContextItems as coreLoadPersistedRuntimeContextItems,
  parseAttachedRuntimeContextItems as coreParseAttachedRuntimeContextItems,
  selectSkillsForRequest as coreSelectSkillsForRequest,
  type ToolOriginMetadata,
} from "@radarboard/assistant-core/tool-evidence";
import type { LlmMessage, LlmSkillDescriptor } from "@radarboard/llm/types";
import { createEmbedFn } from "@radarboard/llm-adapter-vercel/adapter";
import type { AssistantHandoffItem } from "@radarboard/types/assistant";
import type {
  AssistantArtifactRow,
  AssistantMode,
  LlmConfig,
  LlmRepository,
} from "@radarboard/types/database";
import {
  buildActionTools,
  buildAiTools,
  buildArtifactTools,
  buildBlueprintTools,
  buildMemoryTools,
  buildSelfTools,
} from "@/lib/ai-tools";
import {
  getCachedAssistantContext,
  setCachedAssistantContext,
} from "@/lib/assistant-context-cache";
import type { NewDebugEventInput } from "@/lib/debug-events";
import { buildMcpTools } from "@/lib/mcp-bridge";
import { MemoryService } from "@/lib/memory-service";
import {
  buildPluginAiToolsFromResolved,
  buildPluginToolGuidance,
  getResolvedPluginTools,
} from "@/lib/plugin-tool-bridge";

interface ChatRuntimeResult {
  actionTools: Record<string, unknown>;
  mcpTools: Record<string, unknown>;
  pluginTools: Record<string, unknown>;
  pluginToolNames: string[];
  browserToolsAvailable: boolean;
  dependencyArtifacts: AssistantArtifactRow[];
  pluginToolGuidance: string | null;
  lastUserText: string;
  skills: LlmSkillDescriptor[];
  contextMetadata: Record<string, unknown>;
  memories: Array<{ key: string; value: string }>;
  attachedContextSections: string[];
  toolOriginMap: Map<string, ToolOriginMetadata>;
  allTools: Record<string, unknown>;
}

export async function buildChatRuntime(params: {
  connectedKeys: string[];
  llmConfig: LlmConfig;
  llmRepo: LlmRepository;
  mode: AssistantMode;
  pinnedProject: string | null;
  conversationId: string;
  artifactId: string | null;
  attachedArtifactIds: string[];
  attachedNoteIds: string[];
  attachedRuntimeContextItems: AssistantHandoffItem[];
  attachedSkillIds: string[];
  messages: LlmMessage[];
  primarySelection: { providerId: string; apiKey: string };
  emitDebugEvent: (input: NewDebugEventInput) => Promise<string | null>;
  loadAttachedArtifacts: (repo: LlmRepository, ids: string[]) => Promise<AssistantArtifactRow[]>;
  loadAttachedNotes: (ids: string[]) => Promise<AttachedNoteRecord[]>;
}): Promise<ChatRuntimeResult> {
  const cachedCtx = getCachedAssistantContext(params.connectedKeys);
  let aiTools: Record<string, unknown>;
  let actionTools: Record<string, unknown>;
  let mcpTools: Record<string, unknown>;
  let pluginTools: Record<string, unknown>;
  let pluginToolNames: string[];
  let browserToolsAvailable: boolean;

  if (cachedCtx) {
    aiTools = cachedCtx.aiTools;
    actionTools = cachedCtx.actionTools;
    mcpTools = cachedCtx.mcpTools;
    pluginTools = cachedCtx.pluginTools;
    pluginToolNames = cachedCtx.pluginToolNames;
    browserToolsAvailable = cachedCtx.browserToolsAvailable;
  } else {
    aiTools = buildAiTools(params.connectedKeys);
    actionTools = buildActionTools();
    const [builtMcpTools, resolvedPluginToolsForCache] = await Promise.all([
      buildMcpTools().catch(() => ({})),
      getResolvedPluginTools().catch(() => []),
    ]);
    mcpTools = builtMcpTools;
    pluginTools = buildPluginAiToolsFromResolved(resolvedPluginToolsForCache);
    browserToolsAvailable = coreHasAgentBrowserTools(mcpTools);
    pluginToolNames = Object.keys(pluginTools);
    setCachedAssistantContext(params.connectedKeys, {
      aiTools,
      actionTools,
      mcpTools,
      pluginTools,
      pluginToolNames,
      browserToolsAvailable,
    });
  }

  const memoryService = new MemoryService(
    params.llmRepo,
    createEmbedFn({
      providerId: params.primarySelection.providerId,
      apiKey: params.primarySelection.apiKey,
    })
  );

  const [
    memoryTools,
    artifactTools,
    resolvedPluginTools,
    allSkills,
    dependencyArtifacts,
    attachedArtifacts,
    attachedNotes,
    persistedRuntimeContextItems,
  ] = await Promise.all([
    Promise.resolve(buildMemoryTools(memoryService)),
    Promise.resolve(buildArtifactTools(params.llmRepo)),
    getResolvedPluginTools().catch(() => []),
    coreLoadAllSkills(params.llmRepo, params.llmConfig.skillOverrides),
    coreLoadDependencyArtifacts({
      llmRepo: params.llmRepo,
      mode: params.mode,
      projectSlug: params.pinnedProject,
      conversationId: params.conversationId,
      artifactId: params.artifactId,
    }),
    params.loadAttachedArtifacts(params.llmRepo, params.attachedArtifactIds).catch(() => []),
    params.loadAttachedNotes(params.attachedNoteIds).catch(() => []),
    coreLoadPersistedRuntimeContextItems(params.llmRepo, params.conversationId),
  ]);

  const runtimeContextItems = coreParseAttachedRuntimeContextItems([
    ...persistedRuntimeContextItems,
    ...params.attachedRuntimeContextItems,
  ]);
  const pluginToolGuidance = buildPluginToolGuidance(resolvedPluginTools);
  const lastUserText = coreExtractLastUserText(params.messages);
  const topicSkillIds = detectTopicSkills(lastUserText);
  const skills = coreSelectSkillsForRequest(
    allSkills,
    selectSkillsForMode(allSkills, params.mode),
    [...params.attachedSkillIds, ...topicSkillIds]
  );
  const contextMetadata = coreBuildContextDebugMetadata({
    skills: allSkills,
    attachedSkillIds: [...params.attachedSkillIds, ...topicSkillIds],
    attachedArtifacts,
    attachedNotes,
    attachedRuntimeItems: runtimeContextItems,
    dependencyArtifacts,
  });
  const memories = await recallMemories(memoryService, lastUserText);
  const _memoryMetadata = coreBuildMemoryDebugMetadata(lastUserText, memories);
  const attachedContextSections = coreBuildAttachedContextSections({
    attachedArtifacts,
    attachedNotes,
    attachedRuntimeItems: runtimeContextItems,
    dependencyArtifacts,
  });

  const selfTools = buildSelfTools();
  const blueprintTools = buildBlueprintTools();
  const combinedActionTools = { ...actionTools, ...blueprintTools };
  const toolOriginMap = coreBuildToolOriginMap({
    aiTools,
    actionTools: combinedActionTools,
    artifactTools,
    mcpTools,
    memoryTools,
    pluginTools,
    selfTools,
  });
  const allTools = {
    ...aiTools,
    ...combinedActionTools,
    ...memoryTools,
    ...artifactTools,
    ...mcpTools,
    ...pluginTools,
    ...selfTools,
  };

  return {
    actionTools,
    mcpTools,
    pluginTools,
    pluginToolNames,
    browserToolsAvailable,
    dependencyArtifacts,
    pluginToolGuidance,
    lastUserText,
    skills,
    contextMetadata,
    memories,
    attachedContextSections,
    toolOriginMap,
    allTools,
  };
}
