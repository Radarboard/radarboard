/**
 * Project context types for goals, priorities, and notes.
 *
 * These are user-editable per project and injected into the LLM system prompt
 * to give the AI advisor rich context about what matters to the user.
 */

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type GoalStatus = "active" | "achieved" | "dropped";

export interface ProjectGoal {
  id: string;
  title: string;
  targetDate?: string;
  status: GoalStatus;
}

// ---------------------------------------------------------------------------
// Priorities
// ---------------------------------------------------------------------------

export type PriorityEffort = "small" | "medium" | "large";
export type PriorityImpact = "low" | "medium" | "high";
export type PriorityStatus = "active" | "done" | "dropped";

export interface ProjectPriority {
  id: string;
  title: string;
  effort: PriorityEffort;
  impact: PriorityImpact;
  status: PriorityStatus;
}

// ---------------------------------------------------------------------------
// Project stage
// ---------------------------------------------------------------------------

export type ProjectStage = "idea" | "mvp" | "growth" | "mature" | "sunset";

// ---------------------------------------------------------------------------
// Full project context (stored as JSON in user_settings)
// ---------------------------------------------------------------------------

export interface ProjectContext {
  stage?: ProjectStage;
  goals: ProjectGoal[];
  priorities: ProjectPriority[];
  /** Free-form notes injected into the LLM system prompt. */
  notes: string;
}

/** Map of project slug to its context. Stored as a single JSON blob. */
export type ProjectContextMap = Record<string, ProjectContext>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an empty project context. */
export function emptyProjectContext(): ProjectContext {
  return {
    goals: [],
    priorities: [],
    notes: "",
  };
}
