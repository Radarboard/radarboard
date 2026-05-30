import { describe, expect, it } from "vitest";
import { parseSkillMarkdown, parseSkillsCommand } from "../install-skill";

describe("parseSkillMarkdown", () => {
  it("parses valid skill with frontmatter", () => {
    const content = `---
name: seo-expert
description: Deep SEO analysis
---
## Instructions
When analyzing SEO, always check GSC data first.`;

    const skill = parseSkillMarkdown(content);
    expect(skill).not.toBeNull();
    expect(skill?.id).toBe("seo-expert");
    expect(skill?.name).toBe("seo-expert");
    expect(skill?.description).toBe("Deep SEO analysis");
    expect(skill?.instructions).toContain("When analyzing SEO");
  });

  it("generates kebab-case ID from name", () => {
    const content = `---
name: My Custom Skill
description: A test skill
---
Instructions here.`;

    const skill = parseSkillMarkdown(content);
    expect(skill?.id).toBe("my-custom-skill");
  });

  it("returns null for missing frontmatter", () => {
    expect(parseSkillMarkdown("Just plain text")).toBeNull();
  });

  it("returns null for missing name", () => {
    const content = `---
description: No name field
---
Some instructions.`;
    expect(parseSkillMarkdown(content)).toBeNull();
  });

  it("returns null for empty body", () => {
    const content = `---
name: empty
description: No body
---
`;
    expect(parseSkillMarkdown(content)).toBeNull();
  });

  it("handles quoted values in frontmatter", () => {
    const content = `---
name: "quoted-skill"
description: 'Single quoted'
---
Body text.`;

    const skill = parseSkillMarkdown(content);
    expect(skill?.name).toBe("quoted-skill");
    expect(skill?.description).toBe("Single quoted");
  });
});

describe("parseSkillsCommand", () => {
  it("parses npx skills add with owner/repo and --skill", () => {
    const result = parseSkillsCommand("npx skills add vercel-labs/skills --skill find-skills");
    expect(result).toEqual({ owner: "vercel-labs", repo: "skills", skillName: "find-skills" });
  });

  it("parses npx skills add with GitHub URL", () => {
    const result = parseSkillsCommand(
      "npx skills add https://github.com/anthropics/skills --skill pdf"
    );
    expect(result).toEqual({ owner: "anthropics", repo: "skills", skillName: "pdf" });
  });

  it("parses bare owner/repo", () => {
    const result = parseSkillsCommand("anthropics/skills");
    expect(result).toEqual({ owner: "anthropics", repo: "skills", skillName: undefined });
  });

  it("parses GitHub URL without --skill", () => {
    const result = parseSkillsCommand("https://github.com/vercel-labs/skills");
    expect(result).toEqual({ owner: "vercel-labs", repo: "skills", skillName: undefined });
  });

  it("handles -g -y flags", () => {
    const result = parseSkillsCommand("npx skills add vercel-labs/skills --skill react -g -y");
    expect(result).toEqual({ owner: "vercel-labs", repo: "skills", skillName: "react" });
  });

  it("returns null for invalid input", () => {
    expect(parseSkillsCommand("just some text")).toBeNull();
    expect(parseSkillsCommand("")).toBeNull();
  });
});
