"use client";

import { getAssistantModeLabel } from "@radarboard/assistant-core/assistant-workflows";
import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { API_ROUTES, pluginDataRoute } from "@radarboard/types/api-routes";
import type { AssistantArtifactRow } from "@radarboard/types/database";
import type { ProjectContextMap } from "@radarboard/types/project-context";
import { useEffect, useMemo, useState } from "react";

export type InsertTab = "projects" | "notes" | "artifacts";
export type InsertCommandScope = InsertTab | "all";

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatInsertDataState {
  artifacts: AssistantArtifactRow[];
  loading: boolean;
  notes: NoteItem[];
  projectEntries: Array<[string, ProjectContextMap[string]]>;
}

export interface ChatInsertCommandItem {
  action: "insert" | "attach";
  attachment?: { id: string; type: "artifact" | "note" };
  badge?: string;
  description: string;
  id: string;
  insertText: string;
  tab: InsertTab;
  title: string;
}

export interface ChatInsertCommandGroup {
  id: InsertTab;
  items: ChatInsertCommandItem[];
  label: string;
}

export interface ChatInsertCommandMatch {
  from: number;
  query: string;
  scope: InsertCommandScope;
  to: number;
}

const TAB_LABELS: Record<InsertTab, string> = {
  projects: "Projects",
  notes: "Notes",
  artifacts: "Artifacts",
};

function formatProjectContext(slug: string, context: ProjectContextMap[string]): string {
  const sections: string[] = [`## Project Context: @${slug}`];

  if (context.stage) sections.push(`Stage: ${context.stage}`);
  if (context.goals.length > 0) {
    sections.push(
      [
        "Goals:",
        ...context.goals.map(
          (goal) => `- ${goal.title}${goal.targetDate ? ` (target ${goal.targetDate})` : ""}`
        ),
      ].join("\n")
    );
  }
  if (context.priorities.length > 0) {
    sections.push(
      [
        "Priorities:",
        ...context.priorities.map(
          (priority) => `- ${priority.title} (${priority.impact} impact, ${priority.effort} effort)`
        ),
      ].join("\n")
    );
  }
  if (context.notes.trim()) {
    sections.push(`Notes:\n${context.notes.trim()}`);
  }

  return sections.join("\n\n");
}

function formatNote(note: NoteItem): string {
  const sections = [`## Note: ${note.title}`];
  if (note.tags.length > 0) {
    sections.push(`Tags: ${note.tags.map((tag) => `#${tag}`).join(" ")}`);
  }
  if (note.content.trim()) sections.push(note.content.trim());
  return sections.join("\n\n");
}

function formatArtifact(artifact: AssistantArtifactRow): string {
  const sections = [
    `## Artifact: ${artifact.title}`,
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

async function loadProjectContexts(): Promise<ProjectContextMap> {
  const response = await fetch(API_ROUTES.settings);
  if (!response.ok) return {};
  const data = (await response.json()) as { projectContextMap?: ProjectContextMap };
  return data.projectContextMap ?? {};
}

async function loadNotes(): Promise<NoteItem[]> {
  const token = await getPluginToken("notes");
  const response = await fetch(pluginDataRoute("notes", "notes:list"), {
    headers: { "X-Plugin-Token": token },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { value?: string | null };
  const parsed = data.value ? (JSON.parse(data.value) as NoteItem[]) : [];
  return parsed
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 8);
}

async function loadArtifacts(
  activeProject: string | null,
  conversationId: string | null
): Promise<AssistantArtifactRow[]> {
  const params = new URLSearchParams({ limit: "8" });
  if (activeProject) params.set("projectSlug", activeProject);
  else if (conversationId) params.set("sourceConversationId", conversationId);

  const response = await fetch(`${API_ROUTES.chatArtifacts}?${params.toString()}`);
  if (!response.ok) return [];
  const data = (await response.json()) as AssistantArtifactRow[];
  return Array.isArray(data) ? data : [];
}

export function useChatInsertData(
  activeProject: string | null,
  conversationId: string | null,
  enabled: boolean
): ChatInsertDataState {
  const [projectContextMap, setProjectContextMap] = useState<ProjectContextMap>({});
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [artifacts, setArtifacts] = useState<AssistantArtifactRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [nextProjectContextMap, nextNotes, nextArtifacts] = await Promise.all([
          loadProjectContexts(),
          loadNotes(),
          loadArtifacts(activeProject, conversationId),
        ]);

        if (cancelled) return;
        setProjectContextMap(nextProjectContextMap);
        setNotes(nextNotes);
        setArtifacts(nextArtifacts);
      } catch {
        if (!cancelled) {
          setProjectContextMap({});
          setNotes([]);
          setArtifacts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load().catch(() => {
      /* fire-and-forget */
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject, conversationId, enabled]);

  const projectEntries = useMemo(() => {
    const entries = Object.entries(projectContextMap);
    entries.sort(([left], [right]) => {
      if (activeProject && left === activeProject) return -1;
      if (activeProject && right === activeProject) return 1;
      return left.localeCompare(right);
    });
    return entries;
  }, [activeProject, projectContextMap]);

  return { artifacts, loading, notes, projectEntries };
}

export function buildInsertCommandItems(
  activeProject: string | null,
  data: ChatInsertDataState
): ChatInsertCommandItem[] {
  return [
    ...data.projectEntries.map(([slug, context]) => ({
      id: `project:${slug}`,
      action: "insert" as const,
      tab: "projects" as const,
      title: `@${slug}`,
      description: `${context.stage ? `${context.stage} · ` : ""}${context.goals.length} goals · ${context.priorities.length} priorities`,
      insertText: formatProjectContext(slug, context),
      badge: slug === activeProject ? "active" : undefined,
    })),
    ...data.notes.map((note) => ({
      id: `note:${note.id}`,
      action: "attach" as const,
      attachment: { id: note.id, type: "note" as const },
      tab: "notes" as const,
      title: note.title,
      description: note.content || "Empty note",
      insertText: formatNote(note),
      badge: note.tags.length > 0 ? note.tags.map((tag) => `#${tag}`).join(" ") : undefined,
    })),
    ...data.artifacts.map((artifact) => ({
      id: `artifact:${artifact.id}`,
      action: "attach" as const,
      attachment: { id: artifact.id, type: "artifact" as const },
      tab: "artifacts" as const,
      title: artifact.title,
      description: artifact.summary,
      insertText: formatArtifact(artifact),
      badge:
        artifact.contentType === "markdown"
          ? getAssistantModeLabel(artifact.mode)
          : `${getAssistantModeLabel(artifact.mode)} · ${artifact.contentType}`,
    })),
  ];
}

function normalizeCommandScope(token: string): InsertCommandScope | null {
  switch (token.toLowerCase()) {
    case "project":
    case "projects":
      return "projects";
    case "note":
    case "notes":
      return "notes";
    case "artifact":
    case "artifacts":
      return "artifacts";
    default:
      return null;
  }
}

export function parseInsertCommand(
  textBeforeCursor: string,
  selectionFrom: number
): ChatInsertCommandMatch | null {
  const slashIndex = textBeforeCursor.lastIndexOf("/");
  if (slashIndex === -1) return null;

  const previousChar = textBeforeCursor[slashIndex - 1] ?? "";
  if (slashIndex > 0 && !/\s/.test(previousChar)) return null;

  const chunk = textBeforeCursor.slice(slashIndex + 1);
  if (chunk.includes("\n")) return null;

  const firstSpaceIndex = chunk.indexOf(" ");
  if (firstSpaceIndex === -1) {
    const explicitScope = normalizeCommandScope(chunk.trim());
    return {
      from: selectionFrom - (chunk.length + 1),
      to: selectionFrom,
      scope: explicitScope ?? "all",
      query: explicitScope ? "" : chunk.toLowerCase(),
    };
  }

  const verb = chunk.slice(0, firstSpaceIndex).trim();
  const query = chunk.slice(firstSpaceIndex + 1).trimStart();
  const scope = normalizeCommandScope(verb);

  return {
    from: selectionFrom - (chunk.length + 1),
    to: selectionFrom,
    scope: scope ?? "all",
    query: (scope ? query : chunk).toLowerCase(),
  };
}

export function filterInsertCommandItems(
  activeProject: string | null,
  data: ChatInsertDataState,
  scope: InsertCommandScope,
  query: string
): ChatInsertCommandItem[] {
  const allItems = buildInsertCommandItems(activeProject, data);
  const scopedItems = scope === "all" ? allItems : allItems.filter((item) => item.tab === scope);
  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery) return scopedItems.slice(0, 12);

  return scopedItems
    .filter((item) =>
      [item.title, item.description, item.badge ?? ""].some((value) =>
        value.toLowerCase().includes(trimmedQuery)
      )
    )
    .slice(0, 12);
}

export function buildInsertCommandGroups(
  items: ChatInsertCommandItem[],
  scope: InsertCommandScope
): ChatInsertCommandGroup[] {
  if (scope !== "all") {
    return items.length > 0
      ? [
          {
            id: scope,
            label: TAB_LABELS[scope],
            items,
          },
        ]
      : [];
  }

  return (["projects", "notes", "artifacts"] as const)
    .map((tab) => ({
      id: tab,
      label: TAB_LABELS[tab],
      items: items.filter((item) => item.tab === tab),
    }))
    .filter((group) => group.items.length > 0);
}
