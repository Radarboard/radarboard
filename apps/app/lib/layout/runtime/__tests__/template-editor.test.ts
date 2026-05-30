import { describe, expect, it } from "vitest";
import {
  buildTemplateRecipe,
  createTemplateSection,
  getTemplateRecipeBuckets,
  inferTemplateRecipe,
  type TemplateRecipeModel,
} from "../template-editor";

describe("template-editor helpers", () => {
  it("infers a summary-content recipe from a stack layout", () => {
    const sections = buildTemplateRecipe({
      kind: "summary_list",
      summary: [
        {
          type: "kpi-row",
          columns: 1,
          metrics: [
            {
              label: "Visitors",
              source: { sourceId: "analytics", field: "visitors", format: "number" },
            },
          ],
        },
      ],
      content: [
        {
          type: "list",
          source: { sourceId: "analytics", field: "pages" },
          itemTemplate: {
            title: { sourceId: "analytics", field: "path" },
          },
        },
      ],
      rail: [],
    } satisfies TemplateRecipeModel);

    const inferred = inferTemplateRecipe(sections);
    expect(inferred?.kind).toBe("summary_list");
    expect(inferred?.summary).toHaveLength(1);
    expect(inferred?.content).toHaveLength(1);
  });

  it("infers a rail-content recipe from a split layout", () => {
    const sections = buildTemplateRecipe({
      kind: "rail_list",
      summary: [],
      rail: [
        {
          type: "headline-stat",
          source: { sourceId: "sentry", field: "unresolvedCount", format: "number" },
          label: "issues",
        },
      ],
      content: [
        {
          type: "row-list",
          source: { sourceId: "sentry", field: "issues" },
          itemTemplate: {
            title: { sourceId: "sentry", field: "title" },
          },
        },
      ],
      railWidth: 224,
    } satisfies TemplateRecipeModel);

    const inferred = inferTemplateRecipe(sections);
    expect(inferred?.kind).toBe("rail_list");
    expect(inferred?.rail).toHaveLength(1);
    expect(inferred?.content).toHaveLength(1);
    expect(inferred?.railWidth).toBe(224);
  });

  it("builds a summary-chart-list recipe", () => {
    const sections = buildTemplateRecipe({
      kind: "summary_chart_list",
      summary: [createTemplateSection("headline-stat", "analytics")],
      content: [
        createTemplateSection("chart", "analytics"),
        createTemplateSection("list", "analytics"),
      ],
      rail: [],
    } satisfies TemplateRecipeModel);

    const inferred = inferTemplateRecipe(sections);
    expect(inferred?.kind).toBe("summary_chart_list");
    expect(inferred?.summary).toHaveLength(1);
    expect(inferred?.content).toHaveLength(2);
  });

  it("returns the expected recipe buckets", () => {
    expect(getTemplateRecipeBuckets("summary_only")).toEqual(["summary"]);
    expect(getTemplateRecipeBuckets("content_only")).toEqual(["content"]);
    expect(getTemplateRecipeBuckets("summary_chart_list")).toEqual(["summary", "content"]);
    expect(getTemplateRecipeBuckets("rail_list")).toEqual(["rail", "content"]);
    expect(getTemplateRecipeBuckets("feed_list")).toEqual(["content"]);
  });

  it("infers summary-only and content-only recipes from legacy section arrays", () => {
    const summaryOnly = inferTemplateRecipe([createTemplateSection("summary-quad", "revenue")]);
    const contentOnly = inferTemplateRecipe([createTemplateSection("stream-list", "logs")]);

    expect(summaryOnly?.kind).toBe("summary_only");
    expect(contentOnly?.kind).toBe("content_only");
  });
});
