/**
 * AI Action: Think Step — transparent reasoning tool.
 *
 * This is an internal tool the LLM calls to record its reasoning
 * before acting. The step content is passed back as tool output
 * and displayed in a collapsible "Thinking..." UI block.
 *
 * The tool is a no-op in terms of side effects — it simply
 * echoes back the reasoning so it appears in the conversation.
 */

export interface ThinkStepParams {
  thought: string;
  plan?: string[];
}

export interface ThinkStepResult {
  recorded: true;
  thought: string;
  plan?: string[];
}

export function thinkStep(params: ThinkStepParams): ThinkStepResult {
  return {
    recorded: true,
    thought: params.thought,
    plan: params.plan,
  };
}
