import { describe, expect, it } from "vitest";

import { filterCategorySections, normalizeCategoryId } from "../";

describe("normalizeCategoryId", () => {
  const categories = [
    { id: "revenue", label: "Revenue" },
    { id: "analytics", label: "Analytics" },
  ];

  it("returns null when the category param is missing or invalid", () => {
    expect(normalizeCategoryId(null, categories)).toBeNull();
    expect(normalizeCategoryId("unknown", categories)).toBeNull();
  });

  it("returns the category id when it exists", () => {
    expect(normalizeCategoryId("analytics", categories)).toBe("analytics");
  });
});

describe("filterCategorySections", () => {
  const categories = [
    { id: "revenue", label: "Revenue", itemIds: ["a", "b"] },
    { id: "analytics", label: "Analytics", itemIds: ["c"] },
  ] as const;

  it("keeps grouped sections for the All view and drops empty sections after search", () => {
    const sections = filterCategorySections({
      categories,
      activeCategoryId: null,
      matchingIds: new Set(["b", "c"]),
    });

    expect(sections).toEqual([
      { id: "revenue", label: "Revenue", itemIds: ["b"] },
      { id: "analytics", label: "Analytics", itemIds: ["c"] },
    ]);
  });

  it("preserves the selected category even when search yields no matches", () => {
    const sections = filterCategorySections({
      categories,
      activeCategoryId: "revenue",
      matchingIds: new Set(["c"]),
    });

    expect(sections).toEqual([{ id: "revenue", label: "Revenue", itemIds: [] }]);
  });
});
