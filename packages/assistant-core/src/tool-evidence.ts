import { assembleSystemPrompt, type ProjectInput } from "@radarboard/llm/prompt";
import { listBuiltinSkills } from "@radarboard/llm/skills/registry";
import type { LlmMessage, LlmSkillDescriptor } from "@radarboard/llm/types";
import type { AssistantHandoffItem } from "@radarboard/types/assistant";
import type {
  AssistantArtifactRow,
  AssistantEvidenceRef,
  AssistantMode,
  LlmRepository,
} from "@radarboard/types/database";
import type { ProjectContextMap } from "@radarboard/types/project-context";
import { getAssistantModeLabel } from "./assistant-workflows";

export interface AttachedNoteRecord {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

interface ContextDebugReference {
  id: string;
  label: string;
  kind: "artifact" | "note" | "runtime" | "skill";
  badge?: string;
}

export interface ToolOriginMetadata {
  source: "action" | "artifact" | "connector" | "mcp" | "memory" | "plugin" | "self";
  namespace?: string;
}

interface ToolEvidenceRef {
  kind: AssistantEvidenceRef["kind"];
  label: string;
  url?: string;
}

export interface AssistantDebugEventInput {
  level: "debug" | "info" | "warn" | "error";
  source: string;
  eventType: string;
  message: string;
  projectSlug?: string | null;
  traceId?: string | null;
  requestId?: string | null;
  conversationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  status?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}

export function extractLastUserText(messages: LlmMessage[]): string {
  const last = [...messages].reverse().find((message) => message.role === "user");
  if (!last) return "";
  return last.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { type: "text"; text: string }).text)
    .join(" ");
}

export function buildProjectInputs(
  projectContextMap: ProjectContextMap,
  pinnedProject: string | null
): ProjectInput[] {
  return Object.entries(projectContextMap).map(([slug, ctx]) => ({
    slug,
    name: pinnedProject === slug ? slug : slug,
    stage: ctx.stage,
    goals: ctx.goals
      ?.filter((goal) => goal.status === "active")
      .map((goal) => ({
        title: goal.title,
        status: goal.status,
        targetDate: goal.targetDate,
      })),
    priorities: ctx.priorities
      ?.filter((priority) => priority.status === "active")
      .map((priority) => ({
        title: priority.title,
        impact: priority.impact,
        effort: priority.effort,
      })),
    notes: ctx.notes || undefined,
  }));
}

export function buildBaseSystemPrompt(params: {
  projectContextMap: ProjectContextMap;
  memories: { key: string; value: string }[];
  skills: LlmSkillDescriptor[];
  pinnedProject: string | null;
  availableToolNames: string[];
  identityPrompt?: string;
  extraSections?: string[];
}) {
  const projects = buildProjectInputs(params.projectContextMap, params.pinnedProject);
  const singleProject = projects.length === 1 ? projects[0] : undefined;

  const prompt = assembleSystemPrompt({
    projectName: singleProject?.name,
    projectStage: singleProject?.stage,
    projects,
    memories: params.memories,
    skills: params.skills,
    availableTools: params.availableToolNames,
    identityPrompt: params.identityPrompt,
  });

  return [prompt, ...(params.extraSections ?? []).filter(Boolean)].join("\n\n");
}

export async function loadAllSkills(
  llmRepo: LlmRepository,
  skillOverrides?: Record<string, string>
): Promise<LlmSkillDescriptor[]> {
  const builtins = listBuiltinSkills().map((skill) =>
    skillOverrides?.[skill.id]
      ? { ...skill, instructions: skillOverrides[skill.id] as string }
      : skill
  );

  try {
    const customRows = await llmRepo.listSkills();
    const customSkills: LlmSkillDescriptor[] = customRows
      .filter((skill) => skill.enabled)
      .map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        builtin: false,
      }));

    const customMap = new Map(customSkills.map((skill) => [skill.id, skill]));
    const merged = builtins.map((builtin) => customMap.get(builtin.id) ?? builtin);
    const extraCustom = customSkills.filter(
      (skill) => !builtins.some((builtin) => builtin.id === skill.id)
    );
    return [...merged, ...extraCustom];
  } catch {
    return builtins;
  }
}

export function parseAttachedSkillIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)]
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseAttachedEntityIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)]
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeAssistantHandoffItem(value: unknown): AssistantHandoffItem | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.kind !== "string" ||
    typeof record.title !== "string" ||
    typeof record.summary !== "string" ||
    typeof record.bodyMarkdown !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    kind: record.kind,
    title: record.title,
    summary: record.summary,
    bodyMarkdown: record.bodyMarkdown,
    ...(typeof record.badge === "string" ? { badge: record.badge } : {}),
    ...(typeof record.sourceUrl === "string" ? { sourceUrl: record.sourceUrl } : {}),
    ...(typeof record.projectSlug === "string" || record.projectSlug === null
      ? { projectSlug: record.projectSlug as string | null }
      : {}),
    metadata:
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : {},
  };
}

export function parseAttachedRuntimeContextItems(value: unknown): AssistantHandoffItem[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Map(
      value
        .map((item) => normalizeAssistantHandoffItem(item))
        .filter((item): item is AssistantHandoffItem => Boolean(item))
        .map((item) => [`${item.kind}:${item.id}`, item] as const)
    ).values(),
  ];
}

export function selectSkillsForRequest(
  skills: LlmSkillDescriptor[],
  baseSkills: LlmSkillDescriptor[],
  attachedSkillIds: string[]
): LlmSkillDescriptor[] {
  const selected = new Map(baseSkills.map((skill) => [skill.id, skill]));
  if (attachedSkillIds.length === 0) return [...selected.values()];

  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  for (const skillId of attachedSkillIds) {
    const skill = byId.get(skillId);
    if (skill) selected.set(skill.id, skill);
  }

  return [...selected.values()];
}

export function formatAttachedNote(note: AttachedNoteRecord): string {
  const sections = [`## Attached Note: ${note.title}`];
  if (note.tags.length > 0) {
    sections.push(`Tags: ${note.tags.map((tag) => `#${tag}`).join(" ")}`);
  }
  if (note.content.trim()) {
    sections.push(note.content.trim());
  }
  return sections.join("\n\n");
}

export function formatAttachedArtifact(artifact: AssistantArtifactRow): string {
  const sections = [
    `## Attached Artifact: ${artifact.title}`,
    `Mode: ${getAssistantModeLabel(artifact.mode)}`,
    `Summary: ${artifact.summary}`,
  ];

  const body = artifact.body.trim();
  if (!body) return sections.join("\n\n");

  if (artifact.contentType === "html") {
    sections.push(`\`\`\`html\n${body}\n\`\`\``);
  } else if (artifact.contentType === "mermaid") {
    sections.push(body.startsWith("```mermaid") ? body : `\`\`\`mermaid\n${body}\n\`\`\``);
  } else {
    sections.push(body);
  }

  return sections.join("\n\n");
}

export function formatAttachedRuntimeContextItem(item: AssistantHandoffItem): string {
  const sections = [
    `## Attached Context: ${item.title}`,
    `Kind: ${item.kind}`,
    `Summary: ${item.summary}`,
  ];

  if (item.badge) sections.push(`Badge: ${item.badge}`);
  if (item.sourceUrl) sections.push(`Source URL: ${item.sourceUrl}`);
  if (item.bodyMarkdown.trim()) sections.push(item.bodyMarkdown.trim());

  return sections.join("\n\n");
}

export function buildAttachedContextSections(params: {
  attachedArtifacts: AssistantArtifactRow[];
  attachedNotes: AttachedNoteRecord[];
  attachedRuntimeItems: AssistantHandoffItem[];
  dependencyArtifacts: AssistantArtifactRow[];
}): string[] {
  const dependencyArtifactIds = new Set(params.dependencyArtifacts.map((artifact) => artifact.id));
  const sections: string[] = [];

  for (const item of params.attachedRuntimeItems) {
    sections.push(formatAttachedRuntimeContextItem(item));
  }

  for (const note of params.attachedNotes) {
    sections.push(formatAttachedNote(note));
  }

  for (const artifact of params.attachedArtifacts) {
    if (dependencyArtifactIds.has(artifact.id)) continue;
    sections.push(formatAttachedArtifact(artifact));
  }

  return sections;
}

function buildSkillDebugRefs(
  skills: LlmSkillDescriptor[],
  attachedSkillIds: string[]
): ContextDebugReference[] {
  if (attachedSkillIds.length === 0) return [];

  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  return attachedSkillIds
    .map((skillId) => byId.get(skillId))
    .filter((skill): skill is LlmSkillDescriptor => Boolean(skill))
    .map((skill) => ({
      id: skill.id,
      label: skill.name,
      kind: "skill",
      badge: skill.builtin ? "built-in" : "custom",
    }));
}

function buildArtifactDebugRefs(artifacts: AssistantArtifactRow[]): ContextDebugReference[] {
  return artifacts.map((artifact) => ({
    id: artifact.id,
    label: artifact.title,
    kind: "artifact",
    badge: `${getAssistantModeLabel(artifact.mode)} · ${artifact.status}`,
  }));
}

function buildNoteDebugRefs(notes: AttachedNoteRecord[]): ContextDebugReference[] {
  return notes.map((note) => ({
    id: note.id,
    label: note.title,
    kind: "note",
    badge:
      note.tags.length > 0
        ? note.tags
            .slice(0, 3)
            .map((tag) => `#${tag}`)
            .join(" ")
        : undefined,
  }));
}

function buildRuntimeContextDebugRefs(items: AssistantHandoffItem[]): ContextDebugReference[] {
  return items.map((item) => ({
    id: item.id,
    label: item.title,
    kind: "runtime",
    badge: item.badge ?? item.kind,
  }));
}

export function buildContextDebugMetadata(params: {
  skills: LlmSkillDescriptor[];
  attachedSkillIds: string[];
  attachedArtifacts: AssistantArtifactRow[];
  attachedNotes: AttachedNoteRecord[];
  attachedRuntimeItems: AssistantHandoffItem[];
  dependencyArtifacts: AssistantArtifactRow[];
}) {
  const attachedSkills = buildSkillDebugRefs(params.skills, params.attachedSkillIds);
  const attachedArtifacts = buildArtifactDebugRefs(params.attachedArtifacts);
  const attachedNotes = buildNoteDebugRefs(params.attachedNotes);
  const attachedRuntimeItems = buildRuntimeContextDebugRefs(params.attachedRuntimeItems);
  const dependencyArtifacts = buildArtifactDebugRefs(params.dependencyArtifacts);

  return {
    counts: {
      attachedSkills: attachedSkills.length,
      attachedArtifacts: attachedArtifacts.length,
      attachedNotes: attachedNotes.length,
      attachedRuntimeItems: attachedRuntimeItems.length,
      dependencyArtifacts: dependencyArtifacts.length,
    },
    attachedSkills,
    attachedArtifacts,
    attachedNotes,
    attachedRuntimeItems,
    dependencyArtifacts,
  };
}

export function buildRuntimeContextEvidenceRefs(
  items: AssistantHandoffItem[]
): AssistantEvidenceRef[] {
  return items.map((item) => ({
    kind: "entity",
    label: item.title,
    ...(item.sourceUrl ? { url: item.sourceUrl } : {}),
  }));
}

export function buildRuntimeContextParts(items: AssistantHandoffItem[]) {
  return items.map((item) => ({
    type: "runtime-context" as const,
    item,
  }));
}

export async function loadPersistedRuntimeContextItems(
  llmRepo: LlmRepository,
  conversationId: string
): Promise<AssistantHandoffItem[]> {
  let messages: Awaited<ReturnType<LlmRepository["getMessages"]>>;
  try {
    messages = await llmRepo.getMessages(conversationId);
  } catch {
    return [];
  }
  const items: AssistantHandoffItem[] = [];

  for (const message of messages) {
    if (message.role !== "user") continue;

    try {
      const parts = JSON.parse(message.parts) as Array<Record<string, unknown>>;
      for (const part of parts) {
        if (part.type !== "runtime-context") continue;
        const item = normalizeAssistantHandoffItem(part.item);
        if (item) items.push(item);
      }
    } catch {
      // Ignore malformed legacy message payloads.
    }
  }

  return [...new Map(items.map((item) => [`${item.kind}:${item.id}`, item] as const)).values()];
}

export function buildMemoryDebugMetadata(
  query: string,
  memories: { key: string; value: string }[]
) {
  return {
    count: memories.length,
    keys: memories.map((memory) => memory.key),
    query,
  };
}

function normalizeEvidenceRefKind(value: unknown): AssistantEvidenceRef["kind"] {
  return value === "entity" ||
    value === "page" ||
    value === "query" ||
    value === "repo" ||
    value === "url"
    ? value
    : "entity";
}

export function normalizeEvidenceRefs(value: unknown): AssistantEvidenceRef[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      kind: normalizeEvidenceRefKind(item.kind),
      label: typeof item.label === "string" ? item.label : "",
      ...(typeof item.url === "string" ? { url: item.url } : {}),
    }))
    .filter((item) => item.label.length > 0);
}

export function dedupeEvidenceRefs(refs: AssistantEvidenceRef[]): AssistantEvidenceRef[] {
  return [
    ...new Map(
      refs.map((ref) => [`${ref.kind}:${ref.label}:${ref.url ?? ""}`, ref] as const)
    ).values(),
  ];
}

export function summarizeToolPayload(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return {
      kind: "array",
      itemCount: value.length,
    };
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    return {
      kind: "object",
      keyCount: keys.length,
      previewKeys: keys.slice(0, 8),
      ...(typeof record.openLabel === "string" ? { openLabel: record.openLabel } : {}),
      ...(typeof record.openUrl === "string" ? { openUrl: record.openUrl } : {}),
      ...(typeof record.artifactId === "string" ? { artifactId: record.artifactId } : {}),
      ...(Array.isArray(record.events) ? { eventCount: record.events.length } : {}),
    };
  }

  if (typeof value === "string") {
    return {
      kind: "string",
      preview: value.slice(0, 160),
    };
  }

  return {
    kind: value == null ? "nullish" : typeof value,
    value,
  };
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function inferEvidenceKind(record: Record<string, unknown>): ToolEvidenceRef["kind"] {
  if (typeof record.query === "string") return "query";
  if (typeof record.page === "string") return "page";
  if (typeof record.repo === "string") return "repo";
  return "entity";
}

function extractLabel(record: Record<string, unknown>): string | null {
  return (
    (typeof record.title === "string" && record.title) ||
    (typeof record.name === "string" && record.name) ||
    (typeof record.query === "string" && record.query) ||
    (typeof record.page === "string" && record.page) ||
    (typeof record.repo === "string" && record.repo) ||
    (typeof record.id === "string" && record.id) ||
    null
  );
}

function extractUrl(record: Record<string, unknown>): string | null {
  return (
    (typeof record.url === "string" && isHttpUrl(record.url) && record.url) ||
    (typeof record.openUrl === "string" && isHttpUrl(record.openUrl) && record.openUrl) ||
    (typeof record.siteUrl === "string" && isHttpUrl(record.siteUrl) && record.siteUrl) ||
    null
  );
}

function buildRefFromRecord(record: Record<string, unknown>): ToolEvidenceRef | null {
  const label = extractLabel(record);
  const urlCandidate = extractUrl(record);

  if (label && urlCandidate) {
    return { kind: inferEvidenceKind(record), label, url: urlCandidate };
  }
  if (label && (record.id || record.repo || record.query || record.page)) {
    return { kind: inferEvidenceKind(record), label };
  }
  if (urlCandidate) {
    return { kind: "url", label: urlCandidate, url: urlCandidate };
  }
  return null;
}

export function extractToolEvidenceRefs(value: unknown, maxRefs = 12): AssistantEvidenceRef[] {
  const refs: ToolEvidenceRef[] = [];
  const seen = new Set<string>();

  const push = (ref: ToolEvidenceRef) => {
    const key = `${ref.kind}:${ref.label}:${ref.url ?? ""}`;
    if (seen.has(key) || refs.length >= maxRefs) return;
    seen.add(key);
    refs.push(ref);
  };

  const visit = (node: unknown, depth: number) => {
    if (refs.length >= maxRefs || depth > 3) return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }

    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    const ref = buildRefFromRecord(record);
    if (ref) push(ref);

    for (const child of Object.values(record)) {
      visit(child, depth + 1);
    }
  };

  visit(value, 0);
  return refs;
}

export function buildToolOriginMap(toolGroups: {
  actionTools?: Record<string, unknown>;
  aiTools: Record<string, unknown>;
  artifactTools: Record<string, unknown>;
  mcpTools: Record<string, unknown>;
  memoryTools: Record<string, unknown>;
  pluginTools: Record<string, unknown>;
  selfTools: Record<string, unknown>;
}): Map<string, ToolOriginMetadata> {
  const entries: Array<[string, ToolOriginMetadata]> = [];

  for (const toolName of Object.keys(toolGroups.aiTools)) {
    entries.push([toolName, { source: "connector" }]);
  }
  for (const toolName of Object.keys(toolGroups.actionTools ?? {})) {
    entries.push([toolName, { source: "action" }]);
  }
  for (const toolName of Object.keys(toolGroups.memoryTools)) {
    entries.push([toolName, { source: "memory" }]);
  }
  for (const toolName of Object.keys(toolGroups.artifactTools)) {
    entries.push([toolName, { source: "artifact" }]);
  }
  for (const toolName of Object.keys(toolGroups.selfTools)) {
    entries.push([toolName, { source: "self" }]);
  }
  for (const toolName of Object.keys(toolGroups.pluginTools)) {
    entries.push([toolName, { source: "plugin", namespace: toolName.split("__", 1)[0] }]);
  }
  for (const toolName of Object.keys(toolGroups.mcpTools)) {
    entries.push([toolName, { source: "mcp", namespace: toolName.split("__", 1)[0] }]);
  }

  return new Map(entries);
}

export function instrumentTools(
  tools: Record<string, unknown>,
  originMap: Map<string, ToolOriginMetadata>,
  meta: {
    conversationId: string;
    mode: AssistantMode;
    projectSlug: string | null;
    requestId: string;
    traceId: string;
  },
  emitEvent: (input: AssistantDebugEventInput) => Promise<unknown>
): Record<string, unknown> {
  const wrapped: Record<string, unknown> = {};

  for (const [toolName, toolDefinition] of Object.entries(tools)) {
    if (
      !toolDefinition ||
      typeof toolDefinition !== "object" ||
      typeof (toolDefinition as { execute?: unknown }).execute !== "function"
    ) {
      wrapped[toolName] = toolDefinition;
      continue;
    }

    const original = toolDefinition as {
      execute: (...args: unknown[]) => Promise<unknown>;
      [key: string]: unknown;
    };
    const origin = originMap.get(toolName) ?? { source: "connector" as const };

    wrapped[toolName] = {
      ...original,
      execute: async (...args: unknown[]) => {
        const startedAt = Date.now();
        const input = args[0];

        // Fire-and-forget: don't block tool execution on debug event emission
        emitEvent({
          level: "info",
          source: "api/chat",
          eventType: "chat.tool.started",
          message: `Tool started: ${toolName}`,
          projectSlug: meta.projectSlug,
          traceId: meta.traceId,
          requestId: meta.requestId,
          conversationId: meta.conversationId,
          entityType: "tool",
          entityId: toolName,
          status: "started",
          metadata: {
            mode: meta.mode,
            toolName,
            toolSource: origin.source,
            namespace: origin.namespace,
            input,
          },
        }).catch(() => undefined);

        try {
          const result = await original.execute(...args);
          const evidenceRefs = extractToolEvidenceRefs(result);

          // Fire-and-forget: don't block return on debug event emission
          emitEvent({
            level: "info",
            source: "api/chat",
            eventType: "chat.tool.completed",
            message: `Tool completed: ${toolName}`,
            projectSlug: meta.projectSlug,
            traceId: meta.traceId,
            requestId: meta.requestId,
            conversationId: meta.conversationId,
            entityType: "tool",
            entityId: toolName,
            status: "completed",
            durationMs: Date.now() - startedAt,
            metadata: {
              mode: meta.mode,
              toolName,
              toolSource: origin.source,
              namespace: origin.namespace,
              input,
              result: summarizeToolPayload(result),
              evidence: {
                refCount: evidenceRefs.length,
                refs: evidenceRefs,
              },
            },
          }).catch(() => undefined);

          return result;
        } catch (error) {
          // Fire-and-forget: don't block error propagation on debug event emission
          emitEvent({
            level: "warn",
            source: "api/chat",
            eventType: "chat.tool.failed",
            message: `Tool failed: ${toolName}`,
            projectSlug: meta.projectSlug,
            traceId: meta.traceId,
            requestId: meta.requestId,
            conversationId: meta.conversationId,
            entityType: "tool",
            entityId: toolName,
            status: "failed",
            durationMs: Date.now() - startedAt,
            metadata: {
              mode: meta.mode,
              toolName,
              toolSource: origin.source,
              namespace: origin.namespace,
              input,
              error: error instanceof Error ? error.message : String(error),
            },
          }).catch(() => undefined);
          throw error;
        }
      },
    };
  }

  return wrapped;
}
