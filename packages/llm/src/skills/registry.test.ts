import { describe, expect, it } from "vitest";
import type { LlmSkillDescriptor } from "../types";
import {
  getSkill,
  listBuiltinSkills,
  listSkills,
  registerCustomSkill,
  resetCustomSkills,
} from "./registry";

describe("LLM Skills Registry", () => {
  it("returns all built-in skills", () => {
    const skills = listBuiltinSkills();
    const ids = skills.map((s) => s.id);

    expect(ids).toContain("project-advisor");
    expect(ids).toContain("revenue-analyst");
    expect(ids).toContain("growth-advisor");
    expect(ids).toContain("engineering-health");
    expect(ids).toContain("prioritization");
    expect(skills.length).toBe(5);
  });

  it("every built-in skill is marked as builtin", () => {
    for (const skill of listBuiltinSkills()) {
      expect(skill.builtin).toBe(true);
    }
  });

  it("every built-in skill has non-empty instructions", () => {
    for (const skill of listBuiltinSkills()) {
      expect(skill.instructions.length).toBeGreaterThan(0);
    }
  });

  it("retrieves a skill by id", () => {
    const skill = getSkill("revenue-analyst");

    expect(skill).toBeDefined();
    expect(skill?.name).toBe("Revenue Analyst");
  });

  it("returns undefined for unknown skill id", () => {
    expect(getSkill("nonexistent")).toBeUndefined();
  });

  it("supports registering custom skills", () => {
    resetCustomSkills();

    const custom: LlmSkillDescriptor = {
      id: "my-custom",
      name: "My Custom Skill",
      description: "Does custom things",
      instructions: "When asked about X, always do Y.",
      builtin: false,
    };

    registerCustomSkill(custom);

    const all = listSkills();
    expect(all.find((s) => s.id === "my-custom")).toBeDefined();
    expect(getSkill("my-custom")).toEqual(custom);

    resetCustomSkills();
  });

  it("custom skills do not overwrite built-in skills", () => {
    resetCustomSkills();

    const fake: LlmSkillDescriptor = {
      id: "revenue-analyst",
      name: "Fake Override",
      description: "Should not replace built-in",
      instructions: "nope",
      builtin: false,
    };

    registerCustomSkill(fake);

    const skill = getSkill("revenue-analyst");
    expect(skill?.name).toBe("Revenue Analyst");
    expect(skill?.builtin).toBe(true);

    resetCustomSkills();
  });

  it("listSkills returns both built-in and custom skills", () => {
    resetCustomSkills();

    const custom: LlmSkillDescriptor = {
      id: "unique-custom",
      name: "Unique",
      description: "Unique skill",
      instructions: "Do unique things.",
      builtin: false,
    };

    registerCustomSkill(custom);

    const all = listSkills();
    const builtinCount = listBuiltinSkills().length;
    expect(all.length).toBe(builtinCount + 1);

    resetCustomSkills();
  });
});
