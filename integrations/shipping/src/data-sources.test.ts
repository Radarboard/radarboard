import { describe, expect, it } from "vitest";
import { shippingDataSources } from "./api/data-sources";

describe("shippingDataSources", () => {
  it("exports the shipping aggregate data source", () => {
    expect(shippingDataSources).toHaveLength(1);
    expect(shippingDataSources[0]?.action).toBe("data");
  });
});
