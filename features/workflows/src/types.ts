/**
 * Workflow automation engine — type definitions.
 *
 * Workflows are declarative chains of steps triggered by events,
 * schedules, or data thresholds. Steps can fetch data, analyze with
 * LLM, send notifications, or branch conditionally.
 *
 * Observe → Analyze → Explain → Act
 */

// ---------------------------------------------------------------------------
// Trigger types
// ---------------------------------------------------------------------------

export interface ScheduleTrigger {
  type: "schedule";
  /** Cron expression, e.g. "0 8 * * *" for 8am daily. */
  cron: string;
}

export interface EventTrigger {
  type: "event";
  /** SSE channel to listen on. */
  channel: string;
  /** Event type to match (regex supported). */
  eventType: string;
}

export interface ThresholdTrigger {
  type: "threshold";
  /** Integration + action to monitor, e.g. "betterstack/data". */
  dataSource: string;
  /** Metric path within the data source response (dot notation). */
  metricPath: string;
  /** Condition operator. */
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  /** Threshold value. */
  value: number;
}

export type WorkflowTrigger = ScheduleTrigger | EventTrigger | ThresholdTrigger;

// ---------------------------------------------------------------------------
// Step types
// ---------------------------------------------------------------------------

export interface FetchDataStep {
  type: "fetchData";
  /** Integration/action to fetch from. */
  dataSource: string;
  /** Params to pass to the data source. */
  params?: Record<string, unknown>;
  /** Variable name to store the result under (accessible by later steps). */
  outputVar: string;
}

export interface LlmAnalyzeStep {
  type: "llmAnalyze";
  /** Prompt template with {{variable}} placeholders. */
  promptTemplate: string;
  /** Variable name to store the LLM response under. */
  outputVar: string;
}

export interface NotifyStep {
  type: "notify";
  /** Notification channel: "sse" | "webhook" | "toast". */
  channel: "sse" | "webhook" | "toast";
  /** Title template with {{variable}} placeholders. */
  title: string;
  /** Body template. */
  body: string;
}

export interface ConditionStep {
  type: "condition";
  /** Expression to evaluate (simplified: "{{var}} operator value"). */
  expression: string;
  /** Steps to run if condition is true. */
  thenSteps: WorkflowStep[];
  /** Steps to run if condition is false. */
  elseSteps?: WorkflowStep[];
}

export type WorkflowStep = FetchDataStep | LlmAnalyzeStep | NotifyStep | ConditionStep;

// ---------------------------------------------------------------------------
// Workflow definition
// ---------------------------------------------------------------------------

export interface WorkflowExecutionRecord {
  timestamp: number;
  status: "completed" | "failed";
  stepsExecuted: number;
  errors: string[];
  durationMs: number;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  /** Last N execution results (newest first). */
  executionHistory?: WorkflowExecutionRecord[];
}

// ---------------------------------------------------------------------------
// Execution result
// ---------------------------------------------------------------------------

export interface WorkflowExecutionResult {
  workflowId: string;
  startedAt: number;
  completedAt: number;
  stepsExecuted: number;
  variables: Record<string, unknown>;
  errors: string[];
  status: "completed" | "failed";
}
