import type { LlmSkillDescriptor } from "@radarboard/llm/types";
import type {
  AssistantArtifactContentType,
  AssistantArtifactRow,
  AssistantArtifactStatus,
  AssistantMode,
} from "@radarboard/types/database";

const MODE_LABELS: Record<AssistantMode, string> = {
  default: "Chat",
  explore: "Explore",
  plan: "Plan",
  review: "Review",
  qa: "QA",
};

const MODE_DESCRIPTIONS: Record<AssistantMode, string> = {
  default: "General chat with project context and live tools.",
  explore: "Explore the problem space, assumptions, and highest-leverage options.",
  plan: "Produce a concrete implementation plan that can be executed directly.",
  review: "Act as an adversarial reviewer focused on bugs, regressions, and risks.",
  qa: "Run or design explicit QA flows with evidence, pass/fail outcomes, and handoff rules.",
};

const MODE_BUILTIN_SKILLS: Record<AssistantMode, string[] | null> = {
  default: null,
  explore: ["project-advisor", "growth-advisor", "prioritization"],
  plan: ["project-advisor", "prioritization", "engineering-health"],
  review: ["engineering-health", "prioritization"],
  qa: ["engineering-health"],
};

export interface AssistantModePromptContext {
  mode: AssistantMode;
  dependencyArtifacts: AssistantArtifactRow[];
  browserToolsAvailable: boolean;
  challengerModel: string | null;
}

export interface AssistantNextStepRecommendation {
  nextMode: AssistantMode | null;
  nextReason: string | null;
}

export function parseAssistantMode(value: unknown): AssistantMode {
  switch (value) {
    case "explore":
    case "plan":
    case "review":
    case "qa":
      return value;
    default:
      return "default";
  }
}

export function isWorkflowMode(mode: AssistantMode): boolean {
  return mode !== "default";
}

export function getAssistantModeLabel(mode: AssistantMode): string {
  return MODE_LABELS[mode];
}

export function getAssistantModeDescription(mode: AssistantMode): string {
  return MODE_DESCRIPTIONS[mode];
}

export function getAssistantModeOptions(): Array<{ id: AssistantMode; label: string }> {
  return (Object.keys(MODE_LABELS) as AssistantMode[]).map((id) => ({
    id,
    label: MODE_LABELS[id],
  }));
}

export function selectSkillsForMode(
  skills: LlmSkillDescriptor[],
  mode: AssistantMode
): LlmSkillDescriptor[] {
  const builtinIds = MODE_BUILTIN_SKILLS[mode];
  if (!builtinIds) return skills;

  return skills.filter((skill) => !skill.builtin || builtinIds.includes(skill.id));
}

export function selectDependencyArtifacts(
  mode: AssistantMode,
  artifacts: AssistantArtifactRow[],
  artifactId?: string | null
): AssistantArtifactRow[] {
  const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const selected: AssistantArtifactRow[] = [];
  const seen = new Set<string>();

  const add = (artifact: AssistantArtifactRow | undefined) => {
    if (!artifact || seen.has(artifact.id)) return;
    selected.push(artifact);
    seen.add(artifact.id);
  };

  if (artifactId) add(byId.get(artifactId));

  const latestByMode = (targetMode: AssistantMode) =>
    artifacts.find((artifact) => artifact.mode === targetMode && artifact.status !== "failed");

  switch (mode) {
    case "plan":
      add(latestByMode("explore"));
      break;
    case "review":
      add(latestByMode("plan") ?? latestByMode("explore"));
      break;
    case "qa":
      add(latestByMode("review"));
      add(latestByMode("plan") ?? latestByMode("explore"));
      break;
    default:
      break;
  }

  return selected;
}

export function buildAssistantModePrompt(ctx: AssistantModePromptContext): string | null {
  if (!isWorkflowMode(ctx.mode)) return null;

  const sections = [
    "[WORKFLOW MODE]",
    `Current mode: ${MODE_LABELS[ctx.mode]}`,
    MODE_DESCRIPTIONS[ctx.mode],
  ];

  if (ctx.dependencyArtifacts.length > 0) {
    sections.push(formatDependencyArtifacts(ctx.dependencyArtifacts));
  }

  switch (ctx.mode) {
    case "explore":
      sections.push(`[MODE RULES]
- Focus on problem framing, assumptions, constraints, and tradeoffs.
- Do not jump straight to implementation unless the user explicitly asks for it.
- End with a recommended next mode.
- Structure the response as:
  # Title
  ## Goal
  ## Unknowns
  ## Opportunities
  ## Recommendation
  ## Next Step`);
      break;
    case "plan":
      sections.push(`[MODE RULES]
- Produce a decision-complete implementation plan.
- Be explicit about interfaces, data flow, testing, and acceptance criteria.
- End with a recommended next mode.
- Structure the response as:
  # Title
  ## Summary
  ## Implementation
  ## Tests
  ## Risks
  ## Next Step`);
      break;
    case "review":
      sections.push(`[MODE RULES]
- Review with an adversarial mindset: bugs, regressions, missing tests, unclear assumptions.
- Findings come before summary.
- If nothing serious is wrong, say so explicitly and note residual risk.
- End with a recommended next mode.
- Structure the response as:
  # Title
  ## Verdict
  ## Findings
  ## Risks
  ## Recommendation
  ## Next Step`);
      if (ctx.challengerModel) {
        sections.push(
          `A challenger model (${ctx.challengerModel}) will run after this review. Keep findings crisp and independently defensible.`
        );
      }
      break;
    case "qa":
      sections.push(`[MODE RULES]
- Produce an explicit QA run with concrete steps, outcomes, and evidence.
- Mark failures clearly as PASS / FAIL / BLOCKED.
- If auth, MFA, CAPTCHA, or ambiguous UI blocks progress, write HANDOFF REQUIRED and say exactly what needs human input.
- End with a recommended next mode.
- Structure the response as:
  # Title
  ## Target
  ## Steps
  ## Results
  ## Evidence
  ## Handoff
  ## Verdict
  ## Next Step`);
      if (ctx.browserToolsAvailable) {
        sections.push(
          "Browser tools are available through the configured MCP toolset. Use them instead of describing hypothetical QA when real verification is possible."
        );
      } else {
        sections.push(
          "Browser tools are not configured right now. If live UI verification is required, mark the result as BLOCKED and ask for browser setup or human handoff."
        );
      }
      break;
    default:
      break;
  }

  return sections.join("\n\n");
}

export function deriveArtifactStatus(mode: AssistantMode, body: string): AssistantArtifactStatus {
  if (/STATUS:\s*FAILED/i.test(body)) return "failed";
  if (/STATUS:\s*DRAFT/i.test(body)) return "draft";
  if (/HANDOFF REQUIRED/i.test(body) || /STATUS:\s*NEEDS[_\s-]?INPUT/i.test(body)) {
    return "needs_input";
  }
  if (/STATUS:\s*BLOCKED/i.test(body) || /##\s+Verdict[\s\S]*?\bBLOCKED\b/i.test(body)) {
    return "blocked";
  }
  if (
    mode === "qa" &&
    /\b(auth|captcha|mfa|login wall|manual handoff|blocked)\b/i.test(body) &&
    /\bneed|requires|required\b/i.test(body)
  ) {
    return "needs_input";
  }
  return "completed";
}

export function buildArtifactRecord(params: {
  id: string;
  mode: AssistantMode;
  projectSlug: string | null;
  sourceConversationId: string | null;
  body: string;
  contentType?: AssistantArtifactContentType;
  createdAt: string;
  nextMode: AssistantMode | null;
  nextReason: string | null;
  evidenceRefs?: AssistantArtifactRow["evidenceRefs"];
}): AssistantArtifactRow {
  const trimmedBody = params.body.trim();
  const title = extractArtifactTitle(trimmedBody, params.mode);
  return {
    id: params.id,
    projectSlug: params.projectSlug,
    mode: params.mode,
    title,
    summary: extractArtifactSummary(trimmedBody, title),
    body: trimmedBody,
    contentType: params.contentType ?? "markdown",
    status: deriveArtifactStatus(params.mode, trimmedBody),
    sourceConversationId: params.sourceConversationId,
    createdAt: params.createdAt,
    nextMode: params.nextMode,
    nextReason: params.nextReason,
    evidenceRefs: params.evidenceRefs ?? [],
  };
}

export function recommendNextMode(params: {
  mode: AssistantMode;
  status: AssistantArtifactStatus;
  projectStage?: string;
  recentErrorCount: number;
  recentShippingCount: number;
  browserToolsAvailable: boolean;
  dependencyArtifacts: AssistantArtifactRow[];
}): AssistantNextStepRecommendation {
  if (params.status === "blocked" || params.status === "needs_input") {
    return {
      nextMode: params.mode,
      nextReason: "Resolve the blocker or handoff, then rerun the same workflow mode.",
    };
  }

  switch (params.mode) {
    case "explore":
      if (params.projectStage === "sunset") {
        return {
          nextMode: "default",
          nextReason:
            "The project is marked as sunset, so general portfolio chat is the safer next step.",
        };
      }
      return {
        nextMode: "plan",
        nextReason: "The exploration is complete enough to turn into an implementation plan.",
      };
    case "plan":
      return {
        nextMode: "review",
        nextReason:
          params.recentShippingCount > 0
            ? "There is recent shipping activity, so a review can validate the plan against real implementation changes."
            : "The next step is to review the planned approach for correctness and risk before execution.",
      };
    case "review":
      if (params.browserToolsAvailable) {
        return {
          nextMode: "qa",
          nextReason:
            params.recentErrorCount > 0
              ? "There are unresolved debug events, so browser-level QA should verify the risky paths next."
              : "QA is the next gate after review when browser verification is available.",
        };
      }
      return {
        nextMode: "default",
        nextReason:
          "No browser QA tools are configured, so the next step is general follow-up or manual verification.",
      };
    case "qa":
      if (params.recentErrorCount > 0) {
        return {
          nextMode: "review",
          nextReason:
            "QA passed through code paths that still have recent errors, so another review should focus on those failures.",
        };
      }
      return {
        nextMode: "default",
        nextReason:
          "The workflow gate is complete; return to normal assistant mode for follow-up work.",
      };
    default:
      return { nextMode: null, nextReason: null };
  }
}

export function buildChallengerPrompt(params: {
  primaryReview: string;
  dependencyArtifacts: AssistantArtifactRow[];
}): string {
  const blocks = [
    "You are the challenger review model. Read the primary review and produce a second-opinion comparison.",
    "Return markdown with these exact sections:",
    "## Overlap",
    "## Unique Findings",
    "## Disagreements",
    "## Recommendation",
    "",
    "Do not restate the entire primary review. Focus on where you agree, where you add value, and where you disagree.",
  ];

  if (params.dependencyArtifacts.length > 0) {
    blocks.push("", formatDependencyArtifacts(params.dependencyArtifacts));
  }

  blocks.push("", "[PRIMARY REVIEW]", params.primaryReview.trim());
  return blocks.join("\n");
}

function formatDependencyArtifacts(artifacts: AssistantArtifactRow[]): string {
  const lines = ["[UPSTREAM ARTIFACTS]"];
  for (const artifact of artifacts) {
    lines.push(
      `- ${MODE_LABELS[artifact.mode]} | ${artifact.title} | ${artifact.status}${
        artifact.summary ? ` | ${artifact.summary}` : ""
      }`
    );
  }
  return lines.join("\n");
}

function extractArtifactTitle(body: string, mode: AssistantMode): string {
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;

  const firstLine = body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("## "));

  if (firstLine) return firstLine.replace(/^[-*]\s+/, "").slice(0, 100);
  return `${MODE_LABELS[mode]} artifact`;
}

function extractArtifactSummary(body: string, title: string): string {
  const paragraphs = body
    .split("\n\n")
    .map((chunk) => chunk.replace(/^#+\s+/gm, "").trim())
    .filter((chunk) => chunk.length > 0);

  const summary = paragraphs.find((chunk) => chunk !== title) ?? title;
  return summary.length > 220 ? `${summary.slice(0, 217)}...` : summary;
}
