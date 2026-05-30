import type { LlmSkillDescriptor } from "./types";

// ---------------------------------------------------------------------------
// Input types for assembleSystemPrompt
// ---------------------------------------------------------------------------

export interface GoalInput {
  title: string;
  status: string;
  targetDate?: string;
}

export interface PriorityInput {
  title: string;
  impact: string;
  effort: string;
}

export interface MemoryInput {
  key: string;
  value: string;
}

/** Per-project context block for multi-project prompts. */
export interface ProjectInput {
  slug: string;
  name: string;
  stage?: string;
  goals?: GoalInput[];
  priorities?: PriorityInput[];
  notes?: string;
}

export interface SystemPromptParams {
  projectName?: string;
  projectStage?: string;
  goals?: GoalInput[];
  priorities?: PriorityInput[];
  notes?: string;
  /** When provided, replaces flat goals/priorities/notes with labeled per-project sections. */
  projects?: ProjectInput[];
  skills?: LlmSkillDescriptor[];
  memories?: MemoryInput[];
  availableTools?: string[];
  /** Override the built-in identity paragraph. When set, replaces the [IDENTITY] section entirely. */
  identityPrompt?: string;
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

/** Assemble the full system prompt from project context, skills, memory, etc. */
export function assembleSystemPrompt(params: SystemPromptParams): string {
  const sections: string[] = [];

  sections.push(buildIdentity(params.identityPrompt));
  sections.push(buildActiveContext(params));

  if (params.projects && params.projects.length > 0) {
    // Per-project labeled sections replace the flat goals/priorities/notes
    const projectsSection = buildProjects(params.projects);
    if (projectsSection) sections.push(projectsSection);
  } else {
    // Legacy flat sections (single-project or no-project context)
    const goalsSection = buildGoals(params.goals);
    if (goalsSection) sections.push(goalsSection);

    const prioritiesSection = buildPriorities(params.priorities);
    if (prioritiesSection) sections.push(prioritiesSection);

    const notesSection = buildNotes(params.notes);
    if (notesSection) sections.push(notesSection);
  }

  const skillsSection = buildSkills(params.skills);
  if (skillsSection) sections.push(skillsSection);

  const memorySection = buildMemory(params.memories);
  if (memorySection) sections.push(memorySection);

  const toolsSection = buildTools(params.availableTools);
  if (toolsSection) sections.push(toolsSection);

  return sections.join("\n\n");
}

function buildIdentity(override?: string): string {
  if (override?.trim()) return `[IDENTITY]\n${override.trim()}`;
  return `[IDENTITY]
You are an expert advisor for a personal project portfolio dashboard.
You have access to real-time data from all connected integrations via tools.
Your role is to proactively synthesize data, surface trends, and recommend concrete next steps aligned with the user's goals and priorities.
Always use available tools to fetch current data before answering data-related questions.
Be direct and specific — recommend actions, not just observations.`;
}

function buildProjectBlock(project: ProjectInput): string {
  const header = project.stage
    ? `## ${project.name} (${project.slug}) — Stage: ${project.stage}`
    : `## ${project.name} (${project.slug})`;
  const lines: string[] = [header];

  if (project.goals && project.goals.length > 0) {
    lines.push("Goals:");
    for (const g of project.goals) {
      const datePart = g.targetDate ? ` (by ${g.targetDate})` : "";
      lines.push(`  • [${g.status}] ${g.title}${datePart}`);
    }
  }

  if (project.priorities && project.priorities.length > 0) {
    lines.push("Priorities:");
    for (const [i, p] of project.priorities.entries()) {
      lines.push(`  ${i + 1}. ${p.title} (${p.impact} impact / ${p.effort} effort)`);
    }
  }

  if (project.notes) {
    lines.push(`Notes: ${project.notes}`);
  }

  return lines.join("\n");
}

function buildProjects(projects: ProjectInput[]): string | null {
  if (projects.length === 0) return null;
  const blocks = ["[PROJECT CONTEXT]", ...projects.map(buildProjectBlock)];
  return blocks.join("\n\n");
}

function buildActiveContext(params: SystemPromptParams): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`[ACTIVE CONTEXT]`, `Date: ${today}`];

  if (params.projectName) {
    const stagePart = params.projectStage ? ` — Stage: ${params.projectStage}` : "";
    lines.push(`Active project: ${params.projectName}${stagePart}`);
  }

  return lines.join("\n");
}

function buildGoals(goals: GoalInput[] | undefined): string | null {
  if (!goals || goals.length === 0) return null;

  const lines = ["[GOALS]"];
  for (const goal of goals) {
    const datePart = goal.targetDate ? ` (by ${goal.targetDate})` : "";
    lines.push(`• [${goal.status}] ${goal.title}${datePart}`);
  }
  return lines.join("\n");
}

function buildPriorities(priorities: PriorityInput[] | undefined): string | null {
  if (!priorities || priorities.length === 0) return null;

  const lines = ["[PRIORITIES]"];
  for (const [i, p] of priorities.entries()) {
    lines.push(`${i + 1}. ${p.title} (${p.impact} impact / ${p.effort} effort)`);
  }
  return lines.join("\n");
}

function buildNotes(notes: string | undefined): string | null {
  if (!notes) return null;

  return `[NOTES]\n${notes}`;
}

function buildSkills(skills: LlmSkillDescriptor[] | undefined): string | null {
  if (!skills || skills.length === 0) return null;

  const inner = skills.map((s) => `<skill name="${s.id}">\n${s.instructions}\n</skill>`).join("\n");
  return `[SKILLS]\n<skills>\n${inner}\n</skills>`;
}

function buildMemory(memories: MemoryInput[] | undefined): string | null {
  if (!memories || memories.length === 0) return null;

  const lines = ["[RELEVANT MEMORY]"];
  for (const m of memories) {
    lines.push(`• ${m.key}: ${m.value}`);
  }
  return lines.join("\n");
}

function buildTools(tools: string[] | undefined): string | null {
  if (!tools || tools.length === 0) return null;

  return `[AVAILABLE TOOLS]\n${tools.join(", ")}`;
}
