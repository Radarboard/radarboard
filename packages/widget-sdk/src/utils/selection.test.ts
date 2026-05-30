import { describe, expect, it } from "vitest";
import { encodeSelectionValue, parseSelectionValue } from "./selection";

describe("selection helpers", () => {
  it("encodes and parses selection values", () => {
    const encoded = encodeSelectionValue("page", "docs");

    expect(encoded).toBe("page:docs");
    expect(parseSelectionValue(encoded)).toEqual({
      selectionId: "page",
      itemKey: "docs",
    });
  });

  it("rejects malformed selection values", () => {
    expect(parseSelectionValue(null)).toBeNull();
    expect(parseSelectionValue("")).toBeNull();
    expect(parseSelectionValue(":missing-id")).toBeNull();
    expect(parseSelectionValue("missing-key:")).toBeNull();
  });
});
