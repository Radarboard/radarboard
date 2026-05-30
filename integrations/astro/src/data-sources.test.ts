import { describe, expect, it } from "vitest";
import { astroDataSources } from "./api/data-sources";

describe("astroDataSources", () => {
  it("exports the keywords data source", () => {
    expect(astroDataSources).toHaveLength(1);
    expect(astroDataSources[0]?.action).toBe("keywords");
  });
});
