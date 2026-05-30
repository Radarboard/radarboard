/**
 * Workflow scheduler — executes scheduled workflows at their cron intervals.
 *
 * Uses a simple interval-based check (every 60s) that evaluates all enabled
 * workflows with schedule triggers. Not a full cron parser — uses minute-level
 * granularity with simple matching for common patterns.
 *
 * For event and threshold triggers, workflows are executed via the event
 * gateway (not this scheduler).
 */

import { findDataSource } from "@radarboard/integration-sdk/registry";
import { getWorkflowContext } from "./context";
import { evaluateCondition, resolveTemplate } from "./engine";
import { getWorkflow, listWorkflows } from "./repository";
import type {
  FetchDataStep,
  LlmAnalyzeStep,
  NotifyStep,
  Workflow,
  WorkflowExecutionRecord,
  WorkflowExecutionResult,
  WorkflowStep,
} from "./types";

const GLOBAL_KEY = "__radarboard_workflow_scheduler__" as const;
const CHECK_INTERVAL_MS = 60_000; // 1 minute
const MAX_HISTORY_ENTRIES = 10;

/** Record an execution result in the workflow's history. */
async function recordExecution(workflowId: string, result: WorkflowExecutionResult): Promise<void> {
  try {
    const ctx = getWorkflowContext();
    const workflows = await ctx.getWorkflows();
    const wf = workflows[workflowId];
    if (!wf) return;

    const record: WorkflowExecutionRecord = {
      timestamp: result.completedAt,
      status: result.status,
      stepsExecuted: result.stepsExecuted,
      errors: result.errors,
      durationMs: result.completedAt - result.startedAt,
    };

    wf.executionHistory = [record, ...(wf.executionHistory ?? [])].slice(0, MAX_HISTORY_ENTRIES);
    wf.updatedAt = Date.now();
    await ctx.setWorkflows(workflows);
  } catch {
    // Non-critical — history recording failure shouldn't break execution
  }
}

const LAST_RUN_KEY = "__radarboard_workflow_last_run__" as const;

function getLastRunMap(): Map<string, number> {
  const g = globalThis as unknown as Record<string, Map<string, number>>;
  if (!g[LAST_RUN_KEY]) g[LAST_RUN_KEY] = new Map();
  return g[LAST_RUN_KEY];
}

/**
 * Simple cron matcher — supports common patterns:
 * - "* * * * *" (every minute)
 * - "0 * * * *" (every hour)
 * - "0 8 * * *" (daily at 8am)
 * - "0 8 * * 1" (Monday at 8am)
 *
 * Returns true if the cron expression matches the current time.
 */
function cronMatches(cron: string, now: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const checks = [
    { field: minute!, value: now.getMinutes() },
    { field: hour!, value: now.getHours() },
    { field: dayOfMonth!, value: now.getDate() },
    { field: month!, value: now.getMonth() + 1 },
    { field: dayOfWeek!, value: now.getDay() },
  ];

  return checks.every(({ field, value }) => {
    if (field === "*") return true;
    if (field.includes(",")) return field.split(",").some((v) => Number(v) === value);
    if (field.includes("/")) {
      const [, step] = field.split("/");
      return step ? value % Number(step) === 0 : false;
    }
    return Number(field) === value;
  });
}

/**
 * Execute a single workflow step.
 */
async function executeStep(
  step: WorkflowStep,
  variables: Record<string, unknown>
): Promise<void> {
  const ctx = getWorkflowContext();

  switch (step.type) {
    case "fetchData": {
      const fetchStep = step as FetchDataStep;
      const [integration, action] = fetchStep.dataSource.split("/");
      if (!integration || !action) break;
      const ds = findDataSource(integration, action);
      if (!ds) break;
      const dsCtx = ctx.buildDataSourceContext();
      const data = await ds.fetch(
        { projectSlug: null, range: "30d", timeZone: "UTC", forceRefresh: false, ...fetchStep.params },
        dsCtx
      );
      variables[fetchStep.outputVar] = data;
      break;
    }
    case "notify": {
      const notifyStep = step as NotifyStep;
      const title = resolveTemplate(notifyStep.title, variables);
      const body = resolveTemplate(notifyStep.body, variables);
      ctx.emitNotification([{
        source: "workflow",
        type: "workflow.notification",
        severity: "info",
        title,
        body,
        projectSlug: null,
        metadata: { channel: notifyStep.channel },
      }]);
      void ctx.emitDebugEvent({
        level: "info",
        source: "workflow-scheduler",
        eventType: "workflow.notification",
        message: `${title}: ${body}`,
        metadata: { channel: notifyStep.channel, title, body },
      });
      break;
    }
    case "condition": {
      const condStep = step;
      const result = evaluateCondition(condStep.expression, variables);
      const stepsToRun = result ? condStep.thenSteps : (condStep.elseSteps ?? []);
      for (const subStep of stepsToRun) {
        await executeStep(subStep, variables);
      }
      break;
    }
    case "llmAnalyze": {
      const llmStep = step as LlmAnalyzeStep;
      const prompt = resolveTemplate(llmStep.promptTemplate, variables);
      try {
        const { resolveProvider } = await import("@radarboard/assistant-core/provider-selection");
        const { getProvider } = await import("@radarboard/llm/providers/registry");
        const { createVercelAdapter } = await import("@radarboard/llm-adapter-vercel/adapter");
        const credentialRepo = ctx.getCredentialRepo();
        const resolved = await resolveProvider(credentialRepo, {
          isExpiredOAuthToken: () => false,
          refreshOAuthToken: async () => "",
        });
        if (resolved) {
          const providerDef = getProvider(resolved.providerId);
          const modelId = providerDef?.defaultModel ?? "gpt-4o-mini";
          const adapter = createVercelAdapter();
          const result = await adapter.generateText({
            providerId: resolved.providerId,
            apiKey: resolved.apiKey,
            model: modelId,
            systemPrompt: "You are a concise analyst. Summarize the data provided.",
            messages: [{
              id: crypto.randomUUID(),
              role: "user" as const,
              parts: [{ type: "text" as const, text: prompt }],
              createdAt: new Date(),
            }],
          });
          variables[llmStep.outputVar] = result.text;
        } else {
          variables[llmStep.outputVar] = `[No LLM provider configured — raw prompt: ${prompt.slice(0, 200)}]`;
        }
      } catch {
        variables[llmStep.outputVar] = `[LLM analysis failed — prompt: ${prompt.slice(0, 200)}]`;
      }
      break;
    }
  }
}

/**
 * Execute a workflow and return the result.
 */
export async function executeWorkflow(workflow: Workflow): Promise<WorkflowExecutionResult> {
  const startedAt = Date.now();
  const variables: Record<string, unknown> = {};
  const errors: string[] = [];
  let stepsExecuted = 0;

  for (const step of workflow.steps) {
    try {
      await executeStep(step, variables);
      stepsExecuted++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    workflowId: workflow.id,
    startedAt,
    completedAt: Date.now(),
    stepsExecuted,
    variables,
    errors,
    status: errors.length > 0 ? "failed" : "completed",
  };
}

/**
 * Check and run all due scheduled workflows.
 */
async function checkScheduledWorkflows(): Promise<void> {
  const now = new Date();
  const workflows = await listWorkflows();
  const lastRunMap = getLastRunMap();
  const ctx = getWorkflowContext();

  for (const workflow of workflows) {
    if (!workflow.enabled) continue;
    if (workflow.trigger.type !== "schedule") continue;

    if (!cronMatches(workflow.trigger.cron, now)) continue;
    if (lastRunMap.get(workflow.id) === now.getMinutes()) continue;

    lastRunMap.set(workflow.id, now.getMinutes());

    try {
      const result = await executeWorkflow(workflow);
      void recordExecution(workflow.id, result);
      void ctx.emitDebugEvent({
        level: result.status === "completed" ? "info" : "warn",
        source: "workflow-scheduler",
        eventType: `workflow.${result.status}`,
        message: `Workflow "${workflow.name}" ${result.status}`,
        metadata: { workflowId: workflow.id, stepsExecuted: result.stepsExecuted, errors: result.errors },
      });
    } catch (err) {
      void ctx.emitDebugEvent({
        level: "error",
        source: "workflow-scheduler",
        eventType: "workflow.failed",
        message: `Workflow "${workflow.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
        metadata: { workflowId: workflow.id },
      });
    }
  }
}

/**
 * Check and run all threshold-triggered workflows.
 */
async function checkThresholdWorkflows(): Promise<void> {
  const workflows = await listWorkflows();
  const lastRunMap = getLastRunMap();
  const ctx = getWorkflowContext();

  for (const workflow of workflows) {
    if (!workflow.enabled) continue;
    if (workflow.trigger.type !== "threshold") continue;

    const lastRun = lastRunMap.get(workflow.id);
    if (lastRun && Date.now() - lastRun < 300_000) continue;

    try {
      const { dataSource, metricPath, operator, value: threshold } = workflow.trigger;
      const [integration, action] = dataSource.split("/");
      if (!integration || !action) continue;

      const ds = findDataSource(integration, action);
      if (!ds) continue;

      const dsCtx = ctx.buildDataSourceContext();
      const data = await ds.fetch(
        { projectSlug: null, range: "30d", timeZone: "UTC", forceRefresh: false },
        dsCtx
      );

      let metricValue: unknown = data;
      for (const segment of metricPath.split(".")) {
        if (metricValue && typeof metricValue === "object") {
          metricValue = (metricValue as Record<string, unknown>)[segment];
        } else {
          metricValue = undefined;
          break;
        }
      }

      if (typeof metricValue !== "number") continue;

      let conditionMet = false;
      switch (operator) {
        case "gt": conditionMet = metricValue > threshold; break;
        case "lt": conditionMet = metricValue < threshold; break;
        case "eq": conditionMet = metricValue === threshold; break;
        case "gte": conditionMet = metricValue >= threshold; break;
        case "lte": conditionMet = metricValue <= threshold; break;
      }

      if (!conditionMet) continue;

      lastRunMap.set(workflow.id, Date.now());
      const result = await executeWorkflow(workflow);
      void recordExecution(workflow.id, result);
      void ctx.emitDebugEvent({
        level: result.status === "completed" ? "info" : "warn",
        source: "workflow-scheduler",
        eventType: `workflow.threshold.${result.status}`,
        message: `Threshold workflow "${workflow.name}" triggered: ${metricPath}=${metricValue} ${operator} ${threshold}`,
        metadata: { metricPath, metricValue, operator, threshold, ...result, workflowId: workflow.id },
      });
    } catch (err) {
      void ctx.emitDebugEvent({
        level: "error",
        source: "workflow-scheduler",
        eventType: "workflow.threshold.failed",
        message: `Threshold workflow "${workflow.name}" check failed: ${err instanceof Error ? err.message : String(err)}`,
        metadata: { workflowId: workflow.id },
      });
    }
  }
}

/**
 * Start the workflow scheduler. Checks every 60 seconds.
 * Returns a cleanup function to stop the scheduler.
 */
export function startWorkflowScheduler(): () => void {
  const g = globalThis as unknown as Record<string, ReturnType<typeof setInterval>>;

  if (g[GLOBAL_KEY]) {
    clearInterval(g[GLOBAL_KEY]);
  }

  const intervalId = setInterval(() => {
    checkScheduledWorkflows().catch(() => { /* best-effort */ });
    checkThresholdWorkflows().catch(() => { /* best-effort */ });
  }, CHECK_INTERVAL_MS);

  g[GLOBAL_KEY] = intervalId;

  return () => {
    clearInterval(intervalId);
    const gg = globalThis as unknown as Record<string, undefined>;
    gg[GLOBAL_KEY] = undefined;
  };
}

/** Export for testing. */
export { cronMatches };
