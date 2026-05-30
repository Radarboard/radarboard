import {
  buildArtifactRecord,
  parseAssistantMode,
  recommendNextMode,
  selectDependencyArtifacts,
  selectSkillsForMode,
} from "@radarboard/assistant-core/assistant-workflows";
import { describe, expect, it } from "vitest";

describe("assistant-workflows", () => {
  it("falls back to default mode for unknown values", () => {
    expect(parseAssistantMode("invalid")).toBe("default");
    expect(parseAssistantMode("plan")).toBe("plan");
  });

  it("filters builtin skills by mode but keeps custom skills", () => {
    const skills = [
      {
        id: "project-advisor",
        name: "Project Advisor",
        description: "",
        instructions: "",
        builtin: true,
      },
      {
        id: "engineering-health",
        name: "Engineering Health",
        description: "",
        instructions: "",
        builtin: true,
      },
      {
        id: "custom-reviewer",
        name: "Custom Reviewer",
        description: "",
        instructions: "",
        builtin: false,
      },
    ];

    expect(selectSkillsForMode(skills, "review").map((skill) => skill.id)).toEqual([
      "engineering-health",
      "custom-reviewer",
    ]);
  });

  it("selects the latest upstream artifacts for downstream workflow modes", () => {
    const artifacts = [
      {
        id: "explore-1",
        projectSlug: "radarboard",
        mode: "explore" as const,
        title: "Explore",
        summary: "Explore summary",
        body: "Explore body",
        status: "completed" as const,
        sourceConversationId: "conv-1",
        createdAt: "2026-03-19T10:00:00.000Z",
        nextMode: "plan" as const,
        nextReason: "Next",
      },
      {
        id: "plan-1",
        projectSlug: "radarboard",
        mode: "plan" as const,
        title: "Plan",
        summary: "Plan summary",
        body: "Plan body",
        status: "completed" as const,
        sourceConversationId: "conv-2",
        createdAt: "2026-03-19T11:00:00.000Z",
        nextMode: "review" as const,
        nextReason: "Next",
      },
      {
        id: "review-1",
        projectSlug: "radarboard",
        mode: "review" as const,
        title: "Review",
        summary: "Review summary",
        body: "Review body",
        status: "completed" as const,
        sourceConversationId: "conv-3",
        createdAt: "2026-03-19T12:00:00.000Z",
        nextMode: "qa" as const,
        nextReason: "Next",
      },
    ];

    expect(selectDependencyArtifacts("review", artifacts).map((artifact) => artifact.id)).toEqual([
      "plan-1",
    ]);
    expect(selectDependencyArtifacts("qa", artifacts).map((artifact) => artifact.id)).toEqual([
      "review-1",
      "plan-1",
    ]);
  });

  it("derives artifact status and summary from the response body", () => {
    const artifact = buildArtifactRecord({
      id: "artifact-1",
      mode: "qa",
      projectSlug: "radarboard",
      sourceConversationId: "conv-1",
      body: `# QA Run\n\nSTATUS: NEEDS_INPUT\n\n## Handoff\nNeed login credentials.`,
      createdAt: "2026-03-19T12:00:00.000Z",
      nextMode: "qa",
      nextReason: "Retry after login",
    });

    expect(artifact.title).toBe("QA Run");
    expect(artifact.status).toBe("needs_input");
    expect(artifact.summary).toContain("STATUS: NEEDS_INPUT");
  });

  it("recommends QA after review when browser tools are available", () => {
    const recommendation = recommendNextMode({
      mode: "review",
      status: "completed",
      projectStage: "growth",
      recentErrorCount: 2,
      recentShippingCount: 3,
      browserToolsAvailable: true,
      dependencyArtifacts: [],
    });

    expect(recommendation.nextMode).toBe("qa");
    expect(recommendation.nextReason).toContain("debug events");
  });
});
