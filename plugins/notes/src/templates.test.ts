import { describe, expect, it } from "vitest";
import { BUILT_IN_TEMPLATES, hydrateTemplate, mergeTemplates } from "./templates";

describe("notes templates", () => {
  it("hydrates date placeholders", () => {
    const hydrated = hydrateTemplate("## Daily Log\n\nDate: {date}");

    expect(hydrated).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
  });

  it("merges built-ins with user templates and allows overrides", () => {
    const merged = mergeTemplates([
      {
        id: "tpl-meeting",
        name: "My Meeting Notes",
        description: "customized",
        content: "Custom",
        tags: ["meeting"],
        builtIn: false,
        order: 0,
      },
      {
        id: "tpl-custom",
        name: "Custom",
        description: "custom",
        content: "Hello",
        tags: [],
        builtIn: false,
        order: 9,
      },
    ]);

    expect(merged.find((template) => template.id === "tpl-meeting")?.name).toBe("My Meeting Notes");
    expect(merged.find((template) => template.id === "tpl-custom")?.name).toBe("Custom");
    expect(merged).toHaveLength(BUILT_IN_TEMPLATES.length + 1);
  });
});
