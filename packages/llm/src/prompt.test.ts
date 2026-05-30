import { describe, expect, it } from "vitest";
import { assembleSystemPrompt } from "./prompt";
import type { LlmSkillDescriptor } from "./types";

describe("assembleSystemPrompt", () => {
  it("includes identity section", () => {
    const prompt = assembleSystemPrompt({});

    expect(prompt).toContain("[IDENTITY]");
    expect(prompt).toContain("You are an expert advisor");
  });

  it("includes today's date", () => {
    const prompt = assembleSystemPrompt({});
    const today = new Date().toISOString().slice(0, 10);

    expect(prompt).toContain(today);
  });

  it("includes project context when provided", () => {
    const prompt = assembleSystemPrompt({
      projectName: "Goshuin",
      projectStage: "growth",
    });

    expect(prompt).toContain("Goshuin");
    expect(prompt).toContain("growth");
  });

  it("includes goals when provided", () => {
    const prompt = assembleSystemPrompt({
      goals: [
        { title: "Reach $1k MRR", status: "active" },
        { title: "Launch v2", status: "achieved" },
      ],
    });

    expect(prompt).toContain("Reach $1k MRR");
    expect(prompt).toContain("[active]");
    expect(prompt).toContain("Launch v2");
    expect(prompt).toContain("[achieved]");
  });

  it("includes priorities when provided", () => {
    const prompt = assembleSystemPrompt({
      priorities: [{ title: "Fix onboarding", impact: "high", effort: "medium" }],
    });

    expect(prompt).toContain("Fix onboarding");
    expect(prompt).toContain("high impact");
    expect(prompt).toContain("medium effort");
  });

  it("includes notes when provided", () => {
    const prompt = assembleSystemPrompt({
      notes: "Focus on retention this quarter.",
    });

    expect(prompt).toContain("Focus on retention this quarter.");
  });

  it("includes skills when provided", () => {
    const skill: LlmSkillDescriptor = {
      id: "revenue-analyst",
      name: "Revenue Analyst",
      description: "Deep revenue analysis",
      instructions: "Always compare MRR against previous periods.",
      builtin: true,
    };

    const prompt = assembleSystemPrompt({ skills: [skill] });

    expect(prompt).toContain('<skill name="revenue-analyst">');
    expect(prompt).toContain("Always compare MRR against previous periods.");
    expect(prompt).toContain("</skill>");
  });

  it("includes memory entries when provided", () => {
    const prompt = assembleSystemPrompt({
      memories: [{ key: "current_priorities", value: "Focus on SEO and onboarding" }],
    });

    expect(prompt).toContain("current_priorities");
    expect(prompt).toContain("Focus on SEO and onboarding");
  });

  it("omits empty sections gracefully", () => {
    const prompt = assembleSystemPrompt({
      goals: [],
      priorities: [],
      skills: [],
      memories: [],
    });

    expect(prompt).not.toContain("[GOALS]");
    expect(prompt).not.toContain("[PRIORITIES]");
    expect(prompt).not.toContain("[SKILLS]");
    expect(prompt).not.toContain("[RELEVANT MEMORY]");
  });

  it("includes available tools when listed", () => {
    const prompt = assembleSystemPrompt({
      availableTools: ["get_revenue", "get_github_activity"],
    });

    expect(prompt).toContain("get_revenue");
    expect(prompt).toContain("get_github_activity");
  });
});
