import type { AssistantMode } from "@radarboard/types/database";

export type { AssistantPreset } from "./contracts";

export interface AssistantStarterPrompt {
  id: string;
  name: string;
  prompt: string;
  mode: AssistantMode;
  modelId: string | null;
}

export const BUILTIN_ASSISTANT_STARTERS: AssistantStarterPrompt[] = [
  {
    id: "explore-idea",
    name: "Explore Idea",
    mode: "explore",
    modelId: null,
    prompt:
      "Explore this idea. Frame the problem, name the main unknowns, compare options, and recommend the highest-leverage next step.",
  },
  {
    id: "turn-into-plan",
    name: "Turn Into Plan",
    mode: "plan",
    modelId: null,
    prompt:
      "Turn this into an implementation plan with summary, implementation steps, tests, risks, and a clear next step.",
  },
  {
    id: "review-approach",
    name: "Review Approach",
    mode: "review",
    modelId: null,
    prompt:
      "Review this with an adversarial mindset. Focus on bugs, regressions, missing tests, unclear assumptions, and the main risks.",
  },
  {
    id: "weekly-brief",
    name: "Weekly Brief",
    mode: "default",
    modelId: null,
    prompt:
      "Summarize what changed this week across my projects, highlight anomalies or wins, and recommend what I should focus on next.",
  },
];
